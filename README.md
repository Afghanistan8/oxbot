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
| `npm run collab:selftest` | Collab inventory math + concurrent-approval race test (`-- --no-db` for pure checks) |

---

## 🤝 OxFoxes Collab

**OxFoxes Collab** is a whitelist partnership desk that runs inside this app —
same codebase, database, session and design system — on its own host
(`collab.oxbotfoxes.xyz`) or at `/collab` on any host.

- **Listings** — a project lists whitelist spots (NFT or token, chain, total
  spots, and the min/max any one partner can ask for) and a request window.
- **Requests** — every request uses the same fixed intake form: community name
  and size, an X link (required), Discord and Telegram (optional), an optional
  screenshot of a raffle the community has run elsewhere, and how to reach them
  if chosen (X handle, Discord username, or Telegram). There's no scoring —
  the listing team reviews and decides on every request itself.
- **Platform admin** — a project that doesn't want an oxbot account can still
  get a request in: an operator on the `PLATFORM_ADMIN_EMAILS` allowlist files
  one on their behalf from `/admin/collab`, with no Team attached
  (`requesterTeamId: null`, tracked via `addedByAdminId`).
- **Delivery** — partners submit wallets, the listing team exports a CSV and marks
  allocations delivered or revokes them. Off-chain only; nothing is minted.

**Inventory safety.** `totalSpots ≥ reservedSpots + allocatedSpots` is enforced
in `src/lib/collab/inventory.ts`: every grant and approval row-locks the listing
(`SELECT … FOR UPDATE`) inside one transaction. `npm run collab:selftest`
approves a dozen requests concurrently against a small listing and asserts
nothing is oversold (it creates and deletes its own rows).

**Privacy.** Public pages show listing-level fields and counts only (and the
count can be hidden). Requester identities, community details, contact info and
wallets are visible only to the listing team (and the platform admin, for a
request they added); exports are team-gated.

Note: this is a whitelist *allocation* desk between projects — not a public
raffle system. oxbot's own Giveaway system (RANDOM / FCFS / CODE, entry tasks,
seeded draws) is separate and unaffected by Collab.

### Routing

| Request | Serves |
| --- | --- |
| `oxbotfoxes.xyz/*` | oxbot, unchanged |
| `collab.oxbotfoxes.xyz/listings` | rewritten by `src/middleware.ts` to `src/app/(collab)/collab/listings` |
| `collab.oxbotfoxes.xyz/dashboard`, `/signin`, `/profile`, `/giveaways`, `/api` | shared app routes (not rewritten) |
| `any-host/collab/*` | Collab directly — use this locally, no DNS needed |

Locally, open <http://localhost:3000/collab>, or set `COLLAB_HOST=collab.localhost:3000`
and open <http://collab.localhost:3000>. The team side lives at
`/dashboard/[team]/collab` (listings, incoming, outgoing, allocations).

### Deploying the subdomain

1. Add `collab.oxbotfoxes.xyz` as a domain on the same Vercel project.
2. Set `COLLAB_HOST=collab.oxbotfoxes.xyz` and `AUTH_COOKIE_DOMAIN=.oxbotfoxes.xyz`
   so one sign-in covers both hosts (the cookie name is unchanged, so nobody is
   logged out).
3. Set `PLATFORM_ADMIN_EMAILS` (comma-separated) to enable `/admin/collab` for
   whoever operates oxbot.

---

## 🗂️ Project structure

```
src/
  app/                     # Next.js App Router
    page.tsx               # Landing = public giveaways
    giveaways/[slug]/      # Public giveaway page + entry wizard
    dashboard/             # Founder side (auth-gated): teams, giveaways, entrants
      [team]/collab/       # Collab desk: listings, requests, allocations
    (collab)/collab/       # OxFoxes Collab public surface (landing, listings, guide)
    admin/collab/          # Platform-admin tool: add a request with no oxbot account
    api/                   # Auth, uploads, captcha route handlers
  middleware.ts            # Collab host detection + rewrite
  components/
    ui/                    # shadcn/ui primitives (red-themed)
    brand/ giveaway/ dashboard/ entry/ marketing/
  lib/
    brand.ts               # Single source of truth for the brand name
    db.ts auth.ts env.ts   # DB client, auth config, validated env
    rate-limit.ts audit.ts
    brand-collab.ts        # OxFoxes Collab brand copy
    platform-admin.ts      # PLATFORM_ADMIN_EMAILS allowlist gate
    integrations/          # twitter, discord, email, captcha, uploads (mockable)
    giveaway/              # winner-selection, entry-validation, codes
    collab/                # inventory (locked tx), requests, host routing
  server/actions/          # Server Actions (team, giveaway, entry, codes, winners, collab)
scripts/
  collab-selftest.ts       # Collab inventory + concurrent-approval race test
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
