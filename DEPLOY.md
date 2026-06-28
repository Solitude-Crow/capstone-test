# Deploying MKD Guidance to Render

This project deploys as a **single Render Web Service**: Render builds the React
frontend and the Express backend serves it from the same origin. One URL, no
CORS or cross-site-cookie problems.

---

## 0. Before you start — rotate your secrets ⚠️

Your old `backend/.env` contained **real, working credentials** (MongoDB password,
JWT secret, Gmail app password, Google OAuth secret, Gemini key). Treat them as
**compromised** and rotate them before going live, especially if this repo will be
public:

- MongoDB Atlas → reset the database user's password
- Google Cloud → rotate the OAuth client secret + Gemini API key
- Gmail → revoke and regenerate the app password
- JWT_SECRET → generate a fresh random string (e.g. `openssl rand -hex 32`)

The new `.gitignore` keeps `.env` out of git, but anything committed before is
recoverable from history.

---

## 1. Push to GitHub

From `C:\capstone_render`:

```bash
git init
git add .
git commit -m "Prepare for Render deployment"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

Confirm `node_modules/` and `.env` are **not** in the commit (`git status` before
committing — they should be ignored).

## 2. Prepare MongoDB Atlas

In Atlas → **Network Access**, add `0.0.0.0/0` (allow from anywhere). Render's
outbound IPs are dynamic on the free tier, so this is required for the app to
reach your database.

## 3. Create the service on Render

1. Go to the [Render dashboard](https://dashboard.render.com) → **New +** →
   **Blueprint**.
2. Connect your GitHub repo. Render detects `render.yaml`.
3. When prompted, fill in every secret variable (the ones marked `sync: false`):

   | Variable | Value |
   |---|---|
   | `MONGODB_URI` | your Atlas connection string |
   | `JWT_SECRET` | a long random string |
   | `CLIENT_URL` | `https://<your-service-name>.onrender.com` (see note) |
   | `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | from Cloudinary |
   | `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM` | Gmail address + app password |
   | `GEMINI_API_KEY` | from Google AI Studio |
   | `GOOGLE_CLIENT_ID` | your Google OAuth Client ID |
   | `VITE_GOOGLE_CLIENT_ID` | **same** Client ID (used at build time) |

   > **CLIENT_URL note:** the URL is `https://<service-name>.onrender.com`, where
   > `<service-name>` is the name in `render.yaml` (`gabai`).
   > So `CLIENT_URL=https://gabai.onrender.com`. You can set it before the
   > first deploy since the name is fixed.
   >
   > If `gabai.onrender.com` is already taken by another Render account, Render
   > appends a random suffix (e.g. `gabai-a1b2`). Check the real URL on your
   > service's page after the first deploy and update `CLIENT_URL` to match.

4. Click **Apply**. The first build takes a few minutes.

## 4. Configure Google sign-in for the live domain

In [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services**
→ **Credentials** → your OAuth 2.0 Client ID → **Authorized JavaScript origins**,
add:

```
https://gabai.onrender.com
```

Without this, the "Continue with Google" button will fail on the live site.
(No "Authorized redirect URI" is needed — this app uses the Google Identity
token flow, not a redirect.)

## 5. Verify

Visit `https://gabai.onrender.com`. Quick checks:

- `https://gabai.onrender.com/api/health` returns `{"status":"ok",...}`
- The app loads, you can log in (cookie auth), and real-time notifications work
  (Socket.IO).

---

## Notes for the demo

- **Cold starts:** the free plan sleeps after ~15 min of inactivity; the next
  request takes ~50 seconds to wake. **Open the site a minute before your demo**
  so it's warm. (Optional: ping `/api/health` every 10 min with a free uptime
  monitor to keep it awake.)
- **Logs:** view them in the Render dashboard → your service → **Logs**.
- **Redeploys:** every `git push` to `main` triggers an automatic redeploy.

## Local development is unchanged

Run the backend (`npm run dev` in `backend/`) and frontend (`npm run dev` in
`frontend/`) separately as before — the Vite dev proxy still forwards `/api` and
`/socket.io` to `localhost:5000`. The production static-serving code only runs
when `NODE_ENV=production`.
