# oxbot

> A premium Web3 giveaway / raffle platform — with a fierce, elegant **red soul**.

oxbot lets crypto / NFT / project teams register their project and run highly
customizable giveaways. Participants enter by completing tasks (X follow, Discord
membership + roles, CAPTCHA, email verification, entry codes). **Entries are private** —
only the giveaway's own team can see the entrant list, export it, and draw winners.

It supports three giveaway types:

| Type | Behavior |
| --- | --- |
| **Random Raffle** | Random winner selection at the end, using a cryptographically secure RNG + a stored seed so any draw is reproducible and auditable. |
| **FCFS** | First N valid, fully-completed entries win, in chronological order (race-safe sequencing). |
| **Code-based** | Founder generates unique entry codes (single- or multi-use); users need a valid code to enter. Ideal for private / invite-only drops. |

---

## ✨ Highlights

- **Dark, crimson design system** built from the ground up — deep blood-red primary,
  scarlet accents, near-black backgrounds, red-tinted glass surfaces, warm gold for
  winners. Dark mode only. Tailwind v3 + shadcn/ui (heavily themed) + Framer Motion.
- **Three giveaway engines** (Random / FCFS / Code) with server-side rule enforcement.
- **Composable entry requirements** — enable any combination of CAPTCHA, email,
  code, X follow / like / retweet, Discord member / role.
- **Private entrant lists** — public pages never leak entrants; entry counts are
  hideable. Only team members can view + export (CSV).
- **Teams / projects** with roles (Owner / Admin / Editor) and an audit log.
- **Runs with zero external keys** — every integration falls back to a safe local
  mock until you add real credentials (see [Mock mode](#-mock-mode--integrations)).

---

## 🧱 Tech stack

- **Next.js 15** (App Router, Server Actions) + **TypeScript** (strict)
- **PostgreSQL** + **Prisma 6** ORM
- **NextAuth v5 (Auth.js)** — email magic link + X (Twitter) + Discord OAuth
- **Tailwind CSS v3** + **shadcn/ui** + **Framer Motion**
- **Zod** validation everywhere; in-memory rate limiting; CSPRNG winner draws

---

## 🚀 Quick start

### 1. Prerequisites

- **Node.js ≥ 20** (built + tested on Node 24)
- A **PostgreSQL** database. The fastest free option is
  [Neon](https://neon.tech) or [Supabase](https://supabase.com) — create a DB and
  copy the connection string.

### 2. Install

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

At minimum set:

- `DATABASE_URL` — your Postgres connection string
- `AUTH_SECRET` — generate with `openssl rand -base64 32`

Everything else is optional and falls back to mock mode. See
[`.env.example`](.env.example) for the full list.

### 4. Create the schema + seed demo data

```bash
npm run db:push      # push the Prisma schema to your database
npm run db:seed      # insert a demo team + one giveaway of each type
```

### 5. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To sign in during development, enter any email — the magic-link URL is printed to
the **server console** (no SMTP required in mock mode). Paste it into your browser.

---

## 🔌 Mock mode & integrations

oxbot detects missing credentials and runs that integration as a safe mock, so you
can develop the whole flow without any third-party setup:

| Integration | Without keys (mock) | With keys (live) |
| --- | --- | --- |
| **CAPTCHA** | Auto-passes | reCAPTCHA v3 or hCaptcha |
| **Email** | Magic link printed to console | SMTP transport |
| **X (Twitter)** | Connect + follow/like/retweet auto-pass | OAuth 2.0 + API checks |
| **Discord** | Connect + member/role checks auto-pass | OAuth2 + bot role checks |
| **Uploads** | Saved to `/public/uploads` | S3-compatible storage |

Set `OXBOT_FORCE_MOCKS=1` to force mock mode even when keys are present.

### Enabling real integrations

<details>
<summary><b>X (Twitter) developer app</b></summary>

1. Go to <https://developer.x.com> and create an app.
2. Enable **OAuth 2.0**. Add the callback URL
   `http://localhost:3000/api/auth/callback/twitter`.
3. Request at least **Read** scope.
4. Set `AUTH_TWITTER_ID`, `AUTH_TWITTER_SECRET`, and `TWITTER_BEARER_TOKEN` (app-only
   bearer token, used for server-side follow/like/retweet verification).
</details>

<details>
<summary><b>Discord app + bot</b></summary>

1. Go to <https://discord.com/developers/applications> and create an application.
2. Under **OAuth2**, add redirect `http://localhost:3000/api/auth/callback/discord`
   and use scopes `identify`, `guilds`, `guilds.members.read`.
3. Under **Bot**, create a bot and copy its token into `DISCORD_BOT_TOKEN`.
4. Invite the bot to any Discord server you want to gate giveaways on (it needs to
   read members + roles).
5. Set `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`, `DISCORD_BOT_TOKEN`.
</details>

<details>
<summary><b>CAPTCHA (reCAPTCHA v3 or hCaptcha)</b></summary>

1. Create a site key/secret with your provider.
2. Set `CAPTCHA_PROVIDER` to `recaptcha` or `hcaptcha`.
3. Set the matching secret (`RECAPTCHA_SECRET_KEY` / `HCAPTCHA_SECRET_KEY`) and the
   public site key (`NEXT_PUBLIC_CAPTCHA_SITE_KEY`, `NEXT_PUBLIC_CAPTCHA_PROVIDER`).
</details>

<details>
<summary><b>S3-compatible uploads</b></summary>

Set `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
`S3_SECRET_ACCESS_KEY`, and `S3_PUBLIC_URL`. Works with AWS S3, Cloudflare R2,
Supabase Storage, or MinIO.
</details>

---

## 📜 Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm start` | Start the production server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:push` | Push Prisma schema to the DB |
| `npm run db:migrate` | Create + apply a dev migration |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Reset the database (destructive) |

---

## 🗂️ Project structure

```
src/
  app/                     # Next.js App Router
    page.tsx               # Landing = public giveaways
    giveaways/[slug]/      # Public giveaway page + entry wizard
    dashboard/             # Founder side (auth-gated): teams, giveaways, entrants
    api/                   # Auth, uploads, captcha route handlers
  components/
    ui/                    # shadcn/ui primitives (red-themed)
    brand/ giveaway/ dashboard/ entry/ marketing/
  lib/
    brand.ts               # Single source of truth for the brand name
    db.ts auth.ts env.ts   # DB client, auth config, validated env
    rate-limit.ts audit.ts
    integrations/          # twitter, discord, email, captcha, uploads (mockable)
    giveaway/              # winner-selection, entry-validation, codes
  server/actions/          # Server Actions (team, giveaway, entry, codes, winners)
prisma/
  schema.prisma            # Data model
  seed.ts                  # Demo seed
```

---

## 🔐 Security notes

- All Server Actions and route handlers validate input with **Zod**.
- Winner draws use Node's crypto CSPRNG; the seed is stored so a Random draw is
  **reproducible and auditable**.
- FCFS uses transactional, atomic sequence assignment to avoid race conditions.
- Entrant data is authorization-gated to the owning team — never exposed publicly.
- In-memory rate limiting guards entry + mutation endpoints (swap in Redis for
  multi-instance deployments).
- Team mutations are recorded in an **audit log**.

---

## 🛣️ Roadmap (Phase 2)

- Deeper Discord bot integration (announcements, live role re-checks)
- Telegram linking
- Wallet connection + multi-chain proofs (wagmi/viem + Solana adapter)
- Advanced analytics, templates, auto-finalize jobs, email notifications

---

## License

Proprietary — all rights reserved (update as you see fit).
