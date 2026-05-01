# Auth0 Token Vault Setup Guide for Crate

This guide walks you through setting up Auth0 Token Vault so Crate's AI agent can connect to Spotify, Slack, and Google on behalf of your users. No coding required — this is all done through web dashboards.

**Time needed:** About 45 minutes for all three services.

---

## Part 1: Create Your Auth0 Account

1. Go to [auth0.com/signup](https://auth0.com/signup)
2. Sign up with your Google account or email
3. When asked for a tenant name, use something like `crate-music`
   - This becomes your domain: `crate-music.us.auth0.com`
   - Write this down — it's your `AUTH0_DOMAIN`
4. If asked about your role, pick "Developer"
5. If asked about your framework, pick "Next.js"

**Save these values — you'll need them for your `.env.local` file:**

```
AUTH0_DOMAIN=crate-music.us.auth0.com
```

---

## Part 2: Create the Crate Application in Auth0

This tells Auth0 about your app.

1. In the left sidebar, click **Applications > Applications**
2. Click the blue **+ Create Application** button
3. Name: `Crate`
4. Type: Select **Regular Web Applications**
5. Click **Create**

Now you're on the application's Settings page:

6. **Copy these two values** (at the top under "Basic Information"):

```
AUTH0_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AUTH0_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

7. Scroll down to **Application URIs** and fill in:

| Field | Value |
|-------|-------|
| Allowed Callback URLs | `http://localhost:3000/api/auth0/callback, https://digcrate.app/api/auth0/callback` |
| Allowed Logout URLs | `http://localhost:3000, https://digcrate.app` |
| Allowed Web Origins | `http://localhost:3000, https://digcrate.app` |

8. Scroll down further. Click **Advanced Settings** to expand it
9. Click the **Grant Types** tab
10. Check the box for **Token Vault**
11. Click **Save Changes** at the bottom

---

## Part 3: Activate the My Account API

Token Vault uses something called "Connected Accounts" which requires the My Account API. This is a one-time toggle.

1. In the sidebar, go to **Applications > APIs**
2. You'll see a banner for **Auth0 My Account API** — click **Activate**
3. After activation, click on **Auth0 My Account API**
4. Go to the **Application Access** tab
5. Find your "Crate" application in the list
6. Click **Edit** next to it
7. Under **Authorization**, select **Authorized**
8. Under **Permissions**, select **All** the Connected Accounts scopes
9. Click **Save**
10. Go to the **Settings** tab
11. Under **Access Settings**, check **Allow Skipping User Consent**
12. Click **Save**

---

## Part 4: Set Up Spotify Connection

### Step A: Create a Spotify Developer App

1. Go to [developer.spotify.com](https://developer.spotify.com/)
2. Sign in with your Spotify account (create one if needed — free account works)
3. Go to your [Dashboard](https://developer.spotify.com/dashboard)
4. Click **Create app**
5. Fill in:

| Field | Value |
|-------|-------|
| App name | `Crate` |
| App description | `AI music research agent` |
| Redirect URI | `https://crate-music.us.auth0.com/login/callback` |

   **Important:** Replace `crate-music` with YOUR actual Auth0 tenant name from Part 1.

6. Check **Web API** under "Which API/SDKs are you planning to use?"
7. Agree to terms and click **Save**
8. On your new app's page, you'll see the **Client ID** right away
9. Click **Settings** (top right), then click **View client secret** to reveal it
10. **Copy both values** — you'll paste them into Auth0 next

### Step B: Add Spotify to Auth0

1. Back in the Auth0 Dashboard, go to **Authentication > Social** in the sidebar
2. Click **Create Connection**
3. Find and select **Spotify**
4. Click **Continue**
5. Under **General**:
   - Paste your Spotify **Client ID**
   - Paste your Spotify **Client Secret**
6. Under **Attributes** (or **Permissions/Scopes**), make sure these are checked:
   - `user-read-private`
   - `user-read-email`
7. In the **Additional Scopes** field, add these (separated by spaces or commas):
   ```
   user-library-read user-top-read playlist-read-private playlist-modify-public playlist-modify-private
   ```
   These give Crate permission to read the user's library and create playlists.
8. Under **Purpose**, toggle on **"Connected Accounts for Token Vault"**

   This is the critical step. Without this toggle, the connection is only for login, not for API access.

9. Click **Create**
10. On the next screen, find your "Crate" application and toggle it **ON**
11. Click **Save**

**Test it:** Click the **Try Connection** button. You should be redirected to Spotify, asked to authorize, and then sent back to Auth0 with a success message.

---

## Part 5: Set Up Slack Connection

### Step A: Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Sign in with your Slack account
3. Click **Create New App**
4. Select **From scratch**
5. Fill in:

| Field | Value |
|-------|-------|
| App Name | `Crate` |
| Pick a workspace | Select your workspace (e.g., Radio Milwaukee) |

6. Click **Create App**
7. You're now on the app's **Basic Information** page
8. Scroll down to **App Credentials** and copy:
   - **Client ID**
   - **Client Secret**

### Step B: Configure Slack OAuth

Still on the Slack API page for your app:

1. In the left sidebar, click **OAuth & Permissions**
2. Under **Redirect URLs**, click **Add New Redirect URL**
3. Enter: `https://crate-music.us.auth0.com/login/callback`

   (Replace `crate-music` with your Auth0 tenant name)

4. Click **Add** then **Save URLs**
5. Scroll down to **Scopes > Bot Token Scopes**
6. Click **Add an OAuth Scope** and add:
   - `chat:write` (lets Crate send messages to channels)
   - `channels:read` (lets Crate see available channels)
7. Also under **Scopes > User Token Scopes**, add:
   - `chat:write`
   - `channels:read`

### Step C: Enable Token Rotation

1. Still in the Slack API dashboard, go to **OAuth & Permissions**
2. Scroll to **Advanced token security via token rotation**
3. Click **Opt In** to enable token rotation (required for Token Vault refresh tokens)

### Step D: Add Slack to Auth0

1. In Auth0 Dashboard, go to **Authentication > Social**
2. Click **Create Connection**
3. Select **Sign In with Slack** (or just "Slack")
4. Click **Continue**
5. Under **General**:
   - Paste your Slack **Client ID**
   - Paste your Slack **Client Secret**
6. Under **Purpose**, toggle on **"Connected Accounts for Token Vault"**
7. Click **Create**
8. Enable your "Crate" application and **Save**

**Test it:** Click **Try Connection**. You should be redirected to Slack, asked to authorize, and sent back with a success.

---

## Part 6: Set Up Google Connection

Google gives you access to Google Docs, Google Drive, Gmail, and Google Calendar. One connection covers all of them.

### Step A: Create Google Cloud Credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Sign in with your Google account
3. If you don't have a project, click **Select a project > New Project**
   - Name: `Crate`
   - Click **Create**
4. Make sure your new project is selected in the dropdown at the top

### Step B: Enable the APIs

1. In the sidebar, go to **APIs & Services > Library**
2. Search for and **Enable** each of these:
   - **Google Docs API** — click it, click **Enable**
   - **Google Drive API** — click it, click **Enable**
   - (Optional) **Gmail API** — if you want email features later
   - (Optional) **Google Calendar API** — if you want calendar features later

### Step C: Set Up OAuth Consent Screen

1. In the sidebar, go to **APIs & Services > OAuth consent screen** (or **Google Auth Platform > Branding**)
2. User type: **External**
3. Click **Create**
4. Fill in:

| Field | Value |
|-------|-------|
| App name | `Crate` |
| User support email | your email |
| Authorized domains | `auth0.com` |
| Developer contact email | your email |

5. Click **Save and Continue**
6. On the **Scopes** page, click **Add or Remove Scopes**
7. Add these scopes:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/documents` (Google Docs)
   - `https://www.googleapis.com/auth/drive.file` (Google Drive)
8. Click **Update** then **Save and Continue**
9. On **Test Users**, add your email address
10. Click **Save and Continue**, then **Back to Dashboard**

### Step D: Create OAuth Credentials

1. In the sidebar, go to **APIs & Services > Credentials**
2. Click **+ Create Credentials > OAuth client ID**
3. Application type: **Web application**
4. Name: `Crate Auth0`
5. Under **Authorized JavaScript origins**, add:
   ```
   https://crate-music.us.auth0.com
   ```
6. Under **Authorized redirect URIs**, add:
   ```
   https://crate-music.us.auth0.com/login/callback
   ```
   (Replace `crate-music` with your Auth0 tenant name)
7. Click **Create**
8. A popup shows your **Client ID** and **Client Secret** — copy both

### Step E: Add Google to Auth0

1. In Auth0 Dashboard, go to **Authentication > Social**
2. Click **Create Connection**
3. Select **Google / Gmail**
4. Click **Continue**
5. Under **General**:
   - Paste your Google **Client ID**
   - Paste your Google **Client Secret**
6. Under **Permissions**, check:
   - `email`
   - `profile`
7. Check **Offline Access** (this gets refresh tokens — required for Token Vault)
8. In the **Additional Scopes** field, add:
   ```
   https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file
   ```
9. Under **Purpose**, toggle on **"Connected Accounts for Token Vault"**
10. Click **Create**
11. Enable your "Crate" application and **Save**

**Test it:** Click **Try Connection**. You should see Google's consent screen listing the Docs and Drive permissions, then be sent back to Auth0 with a success.

---

## Part 7: Verify Everything

Your **Authentication > Social** page should now show three connections:

```
✅ spotify         Enabled    Token Vault    1 app
✅ slack           Enabled    Token Vault    1 app
✅ google-oauth2   Enabled    Token Vault    1 app
```

Each one should have the "Token Vault" badge — that's the "Connected Accounts for Token Vault" toggle you enabled.

---

## Part 8: Add to Your `.env.local`

Add these to your `.env.local` file (the values from Part 1 and Part 2):

```bash
# Auth0 Token Vault
AUTH0_DOMAIN=crate-music.us.auth0.com
AUTH0_CLIENT_ID=your-client-id-from-part-2
AUTH0_CLIENT_SECRET=your-client-secret-from-part-2
AUTH0_CALLBACK_URL=http://localhost:3000/api/auth0/callback
```

Also add these to your Vercel environment variables for production deployment.

---

## Troubleshooting

**"Try Connection" fails with redirect error:**
- Double-check the redirect URI in each service (Spotify Dashboard, Slack API, Google Cloud Console) matches exactly: `https://YOUR-TENANT.us.auth0.com/login/callback`
- Make sure there are no trailing slashes

**"Connected Accounts for Token Vault" toggle is missing:**
- This feature requires your Auth0 account to be on a plan that supports Token Vault. Free developer accounts should have access. If you don't see it, check [auth0.com/pricing](https://auth0.com/pricing).

**Google scopes not showing in Auth0:**
- Add them in the "Additional Scopes" text field, not the checkbox list. The checkbox list only shows common login scopes.

**Spotify "Invalid redirect URI" error:**
- In the Spotify Developer Dashboard, go to your app's Settings and verify the redirect URI matches your Auth0 domain exactly, including `https://`.

**Slack "oauth_authorization_url_mismatch" error:**
- In the Slack API dashboard under OAuth & Permissions, make sure the redirect URL matches your Auth0 domain. Click Save URLs after adding it.

---

## What Happens Next

Once Auth0 is set up, start a fresh Claude Code session and say:

> "Execute the plan at `docs/superpowers/plans/2026-03-21-auth0-hackathon.md` using subagent-driven development. Working directory: `crate-web-subscription` branch."

The implementation plan builds the code that connects Crate to these Token Vault connections — the "Connect Spotify" buttons in Settings, the agent tools that read libraries and export playlists, and the Slack/Google Docs delivery tools.
