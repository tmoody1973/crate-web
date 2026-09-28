# Tumblr + Auth0 Token Vault Setup Guide

Step-by-step guide to connect Tumblr to Crate via Auth0 Token Vault.

---

## Part 1: Register a Tumblr App

1. Go to **https://www.tumblr.com/oauth/apps** (log in with your Tumblr account)

2. Click **"Register application"** and fill out:

   | Field | Value |
   |-------|-------|
   | Application Name | `Crate` |
   | Application Website | `https://digcrate.app` |
   | Application Description | `AI music research assistant` |
   | Administrative contact email | Your email |
   | Default callback URL | `https://dev-YOUR-TENANT.us.auth0.com/login/callback` |
   | **OAuth2 redirect URLs** | `https://dev-YOUR-TENANT.us.auth0.com/login/callback` |

   > **Important:** You MUST fill in the "OAuth2 redirect URLs" field. Without it, Tumblr won't activate OAuth 2.0 for your app and the Auth0 flow will fail.

3. After registering, Tumblr shows you two values — copy both:
   - **OAuth Consumer Key** (this is your Client ID)
   - **Secret Key** (this is your Client Secret)

---

## Part 2: Create the Connection in Auth0

1. Log into your **Auth0 Dashboard** at https://manage.auth0.com

2. Navigate to: **Authentication** → **Social**

3. Click **"Create Connection"**

4. Find and select **"Tumblr"** from the list

5. Fill in the connection form:

   | Field | Value |
   |-------|-------|
   | Client Id | Paste your **OAuth Consumer Key** from Step 1 |
   | Client Secret | Paste your **Secret Key** from Step 1 |

6. Click **Create**

---

## Part 3: Configure Scopes

Tumblr has 3 OAuth2 scopes. You need all of them:

| Scope | What it does | Why Crate needs it |
|-------|-------------|-------------------|
| `basic` | Read user info, dashboard, likes, following | `/tumblr` command reads dashboard and likes |
| `write` | Create/edit posts, follow/unfollow, like/unlike | `post_to_tumblr` tool publishes research |
| `offline_access` | Get a refresh token (42-min token expiry otherwise) | **Required for Token Vault** to maintain access |

### Where to set them:

1. In Auth0 Dashboard, go to **Authentication** → **Social** → click on your **Tumblr** connection

2. Under **Permissions**, check all three:
   - [x] `basic`
   - [x] `write`
   - [x] `offline_access`

3. Click **Save**

> **Note:** `offline_access` MUST be enabled here in the Dashboard — it's not enough to only pass it in code. Auth0 requires it at the connection level when Token Vault is active.

---

## Part 4: Enable Token Vault

This is the key step that lets Crate retrieve the Tumblr OAuth token server-side.

1. In the same Tumblr connection settings page, find the **"Purpose"** section

2. Toggle ON: **"Connected Accounts for Token Vault"**

3. Auth0 may prompt you to confirm `offline_access` is enabled — confirm it

4. Click **Save**

> **If you don't see the "Connected Accounts" toggle:** Token Vault may not be available for Tumblr on your Auth0 plan. Check that your tenant has the Token Vault feature enabled. Tumblr should work as an OAuth2 social connection — if the toggle doesn't appear, you may need to set up Tumblr as a Custom Social Connection instead.

---

## Part 5: Enable for Your Application

1. Still in the Tumblr connection settings, go to the **"Applications"** tab

2. Find your Crate application and toggle it **ON**

3. Click **Save**

---

## Part 6: Verify the Setup

### Quick check in Auth0:

Your Tumblr connection settings should show:
- Client ID: ✅ (filled)
- Client Secret: ✅ (filled)
- Permissions: `basic`, `write`, `offline_access` all checked
- Purpose: "Connected Accounts for Token Vault" toggled ON
- Applications: Your Crate app enabled

### Test in Crate:

1. Deploy to Vercel (or run locally)
2. Go to **Settings** → **Connected Services**
3. Click **Connect** on Tumblr
4. You should see Tumblr's OAuth consent screen asking to authorize Crate
5. Authorize → redirected back to Crate with "Connected" badge
6. Type `/tumblr` in chat → should see your dashboard feed
7. Type `/tumblr #jazz` → should see tagged posts

---

## How It Works (Under the Hood)

```
User clicks "Connect Tumblr" in Settings
  → Crate redirects to /api/auth0/connect?service=tumblr
  → Auth0 redirects to Tumblr's OAuth2 authorize endpoint
  → User authorizes on Tumblr
  → Tumblr redirects back to Auth0 with authorization code
  → Auth0 exchanges code for access_token + refresh_token
  → Auth0 stores tokens in Token Vault (user's identity)
  → Auth0 redirects to Crate's callback
  → Crate stores auth0_user_id_tumblr cookie
  → Done! Token Vault now serves fresh tokens on demand
```

When you type `/tumblr`:
```
Chat route reads auth0_user_id_tumblr cookie
  → Passes to createTumblrConnectedTools(auth0UserId)
  → Tool calls getTokenVaultToken("tumblr", auth0UserId)
  → Auth0 Management API returns the stored access_token
  → Tool calls Tumblr API with Bearer token
  → Returns posts → rendered as TumblrFeed component
```

Token refresh (automatic):
```
Tumblr access tokens expire every 42 minutes.
Auth0 Token Vault automatically uses the refresh_token
to get a new access_token when needed.
You don't need to handle this — it's transparent.
```

---

## Gotchas

1. **OAuth2 redirect URL is mandatory** — If you skip the "OAuth2 redirect URLs" field in Tumblr's app registration, OAuth2 won't activate and you'll get errors.

2. **Tokens expire in 42 minutes** — Without `offline_access` scope, there's no refresh token and the connection dies after 42 minutes. Always enable it.

3. **MFA policy** — If your Auth0 tenant has MFA set to "Always", Token Vault token exchange may fail. Set MFA to "Never" or use Customize MFA Factors via Actions.

4. **Tumblr Marketplace page typo** — Auth0's Tumblr Marketplace page incorrectly mentions "Pinterest" in one spot. It's a copy-paste bug in their docs — ignore it.

5. **Crate's code already handles scopes** — The `connection_scope` parameter in `/api/auth0/connect/route.ts` passes `basic write offline_access` to Tumblr's OAuth endpoint automatically. The Dashboard scope settings and the code scopes work together.
