# Deploying Finance Tracker (v1 to Vercel)

Single-owner deploy: Vercel for the app, MongoDB Atlas for data. ~15 minutes start to finish if you already have accounts.

## 1. MongoDB Atlas (one-time)

1. Sign in to https://cloud.mongodb.com and create a free **M0** cluster (any region close to you; ap-south-1 / Mumbai for IST).
2. **Database Access** → add a user with password. Note the username + password.
3. **Network Access** → "Allow access from anywhere" (`0.0.0.0/0`). Tighter source-IP rules don't work cleanly with Vercel's serverless functions because outbound IPs rotate.
4. **Database** → **Connect** → **Drivers** → copy the connection string. Looks like:
   ```
   mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Append the database name before the `?`:
   ```
   mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/finance-tracker?retryWrites=true&w=majority
   ```

## 2. Generate secrets locally

```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# OWNER_PASSWORD_HASH (replace <password> with the password you'll use to sign in)
npm run hash-password <password>
```

Copy both outputs — you'll paste them into Vercel's env vars next.

## 3. Vercel project

1. Push this repo to GitHub.
2. Go to https://vercel.com → **Add New** → **Project** → import the repo.
3. Framework preset: **Next.js** (auto-detected).
4. Add **Environment Variables** (all environments — Production, Preview, Development):
   - `MONGODB_URI` — Atlas connection string from step 1.
   - `MONGODB_DB` — `finance-tracker`
   - `NEXTAUTH_SECRET` — output of `openssl rand -base64 32`
   - `NEXTAUTH_URL` — leave blank for first deploy; come back and set to the real `https://your-project.vercel.app` URL after Vercel assigns one.
   - `OWNER_EMAIL` — your email
   - `OWNER_PASSWORD_HASH` — output of `npm run hash-password <password>`
5. Click **Deploy**.

## 4. Set `NEXTAUTH_URL` and redeploy

Once Vercel gives you a production URL (e.g. `https://finance-tracker-abc123.vercel.app`):

1. **Settings → Environment Variables** → set `NEXTAUTH_URL` to that URL.
2. **Deployments** → click the latest → **⋯ → Redeploy** (NextAuth reads this at startup, so the env-var change needs a redeploy to take effect).

If you connect a custom domain later, change `NEXTAUTH_URL` to the new domain and redeploy.

## 5. First sign-in & seed

1. Visit your URL → `/signin` → sign in with `OWNER_EMAIL` + the password you hashed.
2. The first sign-in confirms auth works but won't seed accounts/categories. To seed reference data into Atlas:

   ```bash
   # Locally — make sure .env.local has your Atlas MONGODB_URI
   npm run seed
   ```

   This adds the owner's accounts, counterparties, and Appendix A categories. The script is idempotent.

## 6. Use on your phone

- Open the Vercel URL in mobile Safari / Chrome.
- Optionally **Add to Home Screen** (Safari → Share → Add to Home Screen; Chrome → ⋯ → Install). Full PWA install (offline-first, daily notifications) lands in P10.

## Health checklist after deploy

- [ ] `/signin` loads (no 500)
- [ ] Sign-in succeeds → redirect to `/dashboard`
- [ ] `/accounts` lists the seeded accounts
- [ ] Add a test transaction on `/add` → toast appears → returns to home shows updated balance
- [ ] Theme toggle in the top-right cycles System → Light → Dark
- [ ] Mobile (open the URL on your phone): bottom nav shows, dialogs open full-screen

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| 500 on `/signin` | `NEXTAUTH_SECRET` not set | Set it in Vercel env vars, redeploy. |
| Sign-in fails silently | `OWNER_EMAIL` mismatch or `OWNER_PASSWORD_HASH` wrong | Re-run `npm run hash-password` and update. |
| Callback URL error after sign-in | `NEXTAUTH_URL` not set or stale | Update to current Vercel URL, redeploy. |
| Mongo timeout | Atlas IP allowlist | Set to `0.0.0.0/0` (Vercel functions have rotating IPs). |
| Build fails on Vercel | Node version | This repo requires Node 20+; Vercel defaults are fine. |
