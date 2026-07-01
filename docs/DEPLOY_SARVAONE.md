# Deploy Sarvaone on Vercel (sarvaone.com)

## 1. GitHub

Repo: **https://github.com/kdshah50/Sarvaone**

## 2. Create Vercel project (one time)

1. Log in: `vercel login` (or link at [vercel.com/login](https://vercel.com/login)).
2. From repo root:

```bash
cd /path/to/Sarvaone
vercel link
```

- **Set up project?** Yes  
- **Project name:** `sarvaone`  
- **Link to existing?** No (first time)  
- **Directory:** `./` (Next.js root)

3. Import GitHub repo in Vercel dashboard if you prefer UI: **Add New → Project → kdshah50/Sarvaone**.

## 3. Environment variables (Vercel → Project → Settings → Environment Variables)

Copy from `.env.local` / `.env.example`. Minimum:

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Sarvaone Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `JWT_SECRET` | stable across deploys |
| `NEXT_PUBLIC_APP_URL` | `https://sarvaone.com` |
| `STRIPE_*` | test or live keys |
| `TWILIO_*` | WhatsApp OTP (optional in dev) |

Redeploy after adding vars.

## 4. Custom domain

Vercel → **sarvaone** project → **Settings → Domains**:

1. Add `sarvaone.com`
2. Add `www.sarvaone.com` (optional redirect to apex)

At your DNS registrar (where you bought sarvaone.com):

| Type | Name | Value |
|------|------|--------|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

(Vercel shows exact records after you add the domain.)

## 5. Production deploy

```bash
vercel --prod
```

Or push to `main` with GitHub integration enabled.

## 6. Post-deploy checks

- https://sarvaone.com loads  
- `/auth/login` OTP flow  
- `/ride-share` landing  
- Stripe webhook URL: `https://sarvaone.com/api/webhooks/stripe`
