# Setting Up Google OAuth for Crate (via Auth0 Token Vault)

Crate uses Auth0's `google-oauth2` connection to let users save research to Google Docs. This guide walks through configuring it end-to-end.

> **Sources**: [Auth0 — Call an External IdP API](https://auth0.com/docs/authenticate/identity-providers/calling-an-external-idp-api), [Auth0 — Token Vault](https://auth0.com/ai/docs/intro/token-vault), [Google — Choose Docs API Scopes](https://developers.google.com/workspace/docs/api/auth), [Google — Drive API Scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Google — Configure OAuth Consent Screen](https://developers.google.com/workspace/guides/configure-oauth-consent)

---

## Option A: Use Auth0's Built-in Dev Keys (Fastest)

Auth0 provides default Google OAuth credentials out of the box. This works immediately with no Google Cloud Console setup, but shows "Auth0" as the app name in the consent screen (not "Crate").

### Steps

1. Go to [Auth0 Dashboard](https://manage.auth0.com) → **Authentication** → **Social**
2. Find **Google / Gmail** and click it
3. Under **Credentials**, check if "Use Auth0 dev keys" is toggled ON
4. If yes — you're done. Any Google account can connect. Skip to [Verify It Works](#verify-it-works)
5. If no — you're using custom credentials. See Option B below

### Trade-offs
- **Pro**: Zero setup, works for any Google account immediately
- **Con**: Consent screen says "Auth0" not "Crate", looks less professional
- **Con**: Limited to Auth0's allowed scopes — confirm `documents` and `drive.file` are included

---

## Option B: Use Custom Google Cloud Console Credentials

For a branded consent screen ("Crate wants to access your Google Docs") and full scope control.

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown (top bar) → **New Project**
3. Name it `crate-web` → **Create**
4. Select the new project from the dropdown

### Step 2: Enable APIs

1. Go to **APIs & Services** → **Library**
2. Search and enable:
   - **Google Docs API**
   - **Google Drive API**

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** user type → **Create**
3. Fill in:
   - **App name**: `Crate`
   - **User support email**: your email
   - **App logo**: upload Crate logo (optional)
   - **Developer contact email**: your email
4. Click **Save and Continue**
5. **Scopes** page → **Add or Remove Scopes** → add:
   - `https://www.googleapis.com/auth/documents`
   - `https://www.googleapis.com/auth/drive.file`
   - `openid`
   - `email`
   - `profile`
6. Click **Save and Continue**
7. **Test users** page → this is critical, see Step 5 below

### Step 4: Create OAuth Client ID

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Crate Auth0`
5. **Authorized redirect URIs** — add:
   ```
   https://YOUR_AUTH0_DOMAIN/login/callback
   ```
   Your Auth0 domain includes the region (e.g., `dev-abc123.us.auth0.com`), so the full redirect URI looks like:
   ```
   https://dev-abc123.us.auth0.com/login/callback
   ```
   If you've configured a custom domain in Auth0, use that instead (e.g., `https://auth.digcrate.app/login/callback`)
6. Click **Create**
7. Copy the **Client ID** and **Client Secret**

### Step 5: Handle Testing Mode (CRITICAL)

New Google Cloud apps start in **Testing** mode. While in testing mode:
- Only whitelisted test users can complete the OAuth flow
- Other users see "Error 403: access_denied"
- Max 100 test users

**For the hackathon demo**, add your test users:

1. Go to **APIs & Services** → **OAuth consent screen**
2. Scroll to **Test users** → **+ Add Users**
3. Add the Google email(s) you'll use in the demo
4. Click **Save**

**To remove the restriction** (post-hackathon), publish the app:

1. Go to **OAuth consent screen** → click **Publish App**
2. Google may require a verification review if you're requesting sensitive scopes
3. **Scope classifications** (per [Google's docs](https://developers.google.com/workspace/docs/api/auth)):
   - `drive.file` — **Non-sensitive** (recommended, no verification needed)
   - `documents` — **Sensitive** (requires Google review, can take days/weeks)
4. For hackathon: just add test users, don't try to publish

### Step 6: Configure Auth0

1. Go to [Auth0 Dashboard](https://manage.auth0.com) → **Authentication** → **Social**
2. Find **Google / Gmail** → click it
3. Toggle OFF "Use Auth0 dev keys"
4. Paste your **Client ID** and **Client Secret** from Step 4
5. Under **Permissions**, ensure these scopes are listed:
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/documents`
   - `https://www.googleapis.com/auth/drive.file`
6. Click **Save Changes**

---

## Verify It Works

### Quick test via browser

1. Go to `https://digcrate.app` and sign in
2. Open **Settings** → **Connected Services**
3. Click **Connect** next to Google
4. Auth0 should redirect to Google's consent screen
5. Authorize → you should land back at Crate with "Connected" badge

### Debug endpoint

Hit the debug endpoint to inspect the Auth0 identity:

```
https://digcrate.app/api/auth0/debug
```

Look for:
```json
{
  "userIdentities": [
    {
      "provider": "google-oauth2",
      "connection": "google-oauth2",
      "hasAccessToken": true,
      "hasRefreshToken": false
    }
  ]
}
```

If `hasAccessToken` is `true`, Token Vault is working.

### Test the tool

In Crate's chat, try:
```
Save this to Google Docs: "Test document from Crate"
```

The agent should call `save_to_google_doc`, create a new Google Doc, and return a link.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Error 403: access_denied" on Google consent | App in testing mode, user not whitelisted | Add user's email to test users in GCP console |
| Consent screen shows "Auth0" not "Crate" | Using Auth0 dev keys | Switch to custom credentials (Option B) |
| `hasAccessToken: false` in debug | Token exchange failed or scopes not granted | Re-check scopes in Auth0 dashboard match GCP |
| "Google Docs API error: 403" | Google Docs API not enabled | Enable it in GCP → APIs & Services → Library |
| "Google Docs API error: 401" | Token expired and no refresh token | User needs to disconnect and reconnect Google |
| Redirect URI mismatch error | Auth0 callback URL not in GCP allowed redirects | Add `https://{YOUR_AUTH0_DOMAIN}/login/callback` to GCP authorized redirect URIs |
| `getTokenVaultToken` returns `null` despite being connected | Management API missing required scopes | In Auth0 Dashboard, grant `read:users` + `read:user_idp_tokens` to your M2M app |

---

## How Token Retrieval Works (Auth0 Internals)

Crate uses Auth0's **Management API** to retrieve IdP access tokens. Per [Auth0's docs](https://auth0.com/docs/authenticate/identity-providers/calling-an-external-idp-api):

1. Crate's server calls `POST https://{domain}/oauth/token` with `client_credentials` grant to get a Management API token
2. Then calls `GET https://{domain}/api/v2/users/{auth0UserId}?fields=identities` with that token
3. The response contains `user.identities[].access_token` — the Google OAuth token

**Required Management API scopes** (configured in Auth0 Dashboard → Applications → APIs → Auth0 Management API → Machine to Machine Applications):
- `read:users`
- `read:user_idp_tokens`

If these scopes aren't granted, `getTokenVaultToken("google")` will return `null` even after a successful OAuth connection.

> **Note**: Auth0 also offers a newer [Token Exchange](https://auth0.com/ai/docs/intro/token-vault) approach (RFC 8693) as the recommended method for AI agents. Crate currently uses the Management API method, which works fine. A future upgrade could switch to Token Exchange for better token isolation.

---

## Relevant Files

| File | Purpose |
|------|---------|
| `src/lib/auth0-token-vault.ts` | Token retrieval — `getTokenVaultToken("google", auth0UserId)` |
| `src/lib/web-tools/google-docs.ts` | `save_to_google_doc` tool implementation |
| `src/app/api/auth0/connect/route.ts` | OAuth redirect (builds Auth0 authorize URL) |
| `src/app/api/auth0/callback/route.ts` | OAuth callback (exchanges code, stores cookies) |
| `src/app/api/auth0/debug/route.ts` | Debug endpoint (shows identity + token status) |
