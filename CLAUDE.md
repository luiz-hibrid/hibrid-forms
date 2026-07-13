# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Hibrid Forms** — a multi-step form builder (Typeform/Yay-style) that Hibrid, a paid-traffic agency, uses to capture and qualify leads for its clients. Next.js 14 App Router + TypeScript + Tailwind on Vercel, with Supabase (Postgres + Storage) as the datastore. It is an internal, multi-tenant tool (agency = master; each client = a workspace), not a public SaaS.

## Commands

```bash
npm run dev      # local dev server
npm run build    # production build (also the type-check gate)
npm run lint     # next lint
npm start        # run built app
```

There is **no test suite**. The de-facto check is `npm run build` (it runs `tsc` — a type error fails the build). Always build before considering a change done.

### Build quirk (important)

The project is edited inside a mounted/fuse folder where `next build` **hangs on file watching**. To validate a build, copy the source to a native tmp dir and build there:

```bash
rsync -a --exclude node_modules --exclude .next "<repo>/" /tmp/hb && cd /tmp/hb
npm install --silent && npx next build
```

`/tmp` can be wiped between sessions — recreate it when missing. Do the real edits in the repo (so they persist for the user), then copy changed files into `/tmp/hb` to build-check.

The user deploys by committing/pushing via **GitHub Desktop**; Vercel auto-deploys. The user works only in the web UI / GitHub Desktop — never assume they run terminal commands. After changes, tell them to Commit + Push.

## Architecture

### Two surfaces
- **Public runtime** — `app/f/[slug]/page.tsx` renders a form by slug via `FormRunner`. Server component injects theme CSS vars + pixel scripts; the runner handles steps, scoring, conditional flow, and submission.
- **Admin panel** — `app/admin/*`, gated by session auth. Master manages workspaces/users/forms; clients see only results for their workspace.

### Data model (Supabase; see `supabase-schema.sql` + migrations applied via the Supabase MCP)
- `workspaces` — a client/tenant.
- `users` — login accounts (`role` master|client, `workspace_id`, scrypt `password_hash`).
- `forms` — `slug`, `name`, `published`, `config` (JSONB = the whole `FormConfig`), `workspace_id`.
- `submissions` — leads. `status` `complete`|`partial`, `answers` JSONB, `score`, `tier`, `qualified`, `tracking` (utm/gclid), geo columns, `stage`+`labels` (Kanban), `session` (dedupe for progressive save), `gads_status`/`gads_error`/`gads_sent_at`, `duration_ms`, `workspace_id`.
- `form_events` — funnel events `view`|`start`|`step` with `session` + `step` (only when a form has `trackDropoff`).

The form's entire configuration lives in `forms.config` as a `FormConfig` (see `lib/types.ts`) — steps, tiers, endScreens, pixel, theme, kanban columns, and flags like `trackDropoff`, `pageTitle`, `logoUrl`, `notifyEmails`, `webhookUrl`. The editor serializes state → `config` on save (`FormEditor.buildConfig`); the runtime and results read it back.

### Auth & multi-tenancy (`lib/auth.ts`, `lib/users.ts`)
- Session = signed (HMAC via `ADMIN_SESSION_SECRET`) cookie carrying `{ userId, role, workspaceId }`. Passwords hashed with Node `scrypt` (`scrypt$salt$hash`).
- `getSession()`, `isAuthenticated()`, `activeWorkspaceId()` are the primitives. Master can switch the active workspace (stored in a second cookie); clients are locked to their own.
- **Scoping rule:** every admin query/page filters by workspace derived from the session — clients get `s.workspaceId`; master gets the active-workspace cookie (or all). Never trust a workspace id from the request body. Form create/edit/delete is master-only; clients are results-only.

### Server data access
- `lib/supabase.ts` → `getSupabaseAdmin()` uses the **service_role** key server-side only, with `fetch` forced to `cache: "no-store"` (Next Data Cache otherwise serves stale reads — this bit us before).
- `lib/forms-db.ts` — `getFormBySlug` (public runtime), `getFormRow(id, workspaceId?)` (scoped), `listForms(workspaceId?)` (includes a `preview` used for the live card thumbnail), `getWorkspaceIdBySlug`.

### Submission pipeline (`app/api/submit/route.ts`)
On a completed lead: upsert by `session` (promotes an existing partial row to `complete`) → CRM webhook (`lib/crm.ts`, retry/backoff) → Meta CAPI + GA4 Measurement Protocol (`lib/pixel-server.ts`) → Google Ads offline conversion if `qualified && gclid` (`lib/google-ads.ts`) → Resend email notification (`lib/email.ts`). Partial saves go to `app/api/submit/partial/route.ts` and never fire webhook/pixel/conversion.

### Scoring & flow (`lib/scoring.ts`, `lib/ends.ts`)
Options carry `weight` (score) and `next` (conditional routing: a step id, `__end__`, or `end:<endScreenId>`). Tiers map score % → an end screen. `resolveEndScreen` picks the final screen from a forced end id or the score tier. Kanban columns can be flagged `qualified`; moving a lead there fires the conversion manually (`app/api/admin/submissions/[id]` PATCH with `qualify:true`).

### Tracking / conversions
- Client-side pixels via GTM/Meta/GA4 (`components/PixelInit.tsx`); the runner pushes a rich `dataLayer` (`generate_lead` with `user_data` for Enhanced Conversions). Avoid double-firing `generate_lead` (dataLayer push only — no extra `gtag`).
- Google Ads API (`lib/google-ads.ts`, `API_VERSION` currently `v23`): OAuth refresh-token → access token; MCC-level creds in env, per-client Customer ID + Conversion Action ID in the form's `pixel`. `testCredentials`/`verifyConversionAction` back the "Validar conexão" button.

### Theming
`lib/theme.ts` `themeVars()` emits `--form-*` CSS variables from `ThemeConfig`, applied on the public page `<main>` and the editor preview. Form UI accents (input focus border, selected option, checks) follow `--form-btn-bg`; subtitles use `--form-subtitle`. Public form containers use `min-h-[100dvh]` (iOS/Chrome mobile centering).

## Environment variables

Auth/DB: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SESSION_SECRET`.
CRM: `CRM_WEBHOOK_URL` (global fallback), `CRM_WEBHOOK_TOKEN`.
Email (Resend): `RESEND_API_KEY`, `RESEND_FROM` (`Name <addr@verified-domain>`), `LEAD_NOTIFY_EMAILS` (global fallback).
Google Ads (MCC-level, one-time): `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (MCC id). Per-client Customer/Conversion Action IDs live in each form.

## Conventions & gotchas

- Fonts are self-hosted (BR Firma) in `app/fonts` — do **not** add `next/font/google`; it hung the build previously.
- UI language is **Brazilian Portuguese**; match it in user-facing strings.
- Async server components render `AdminHeader` etc. directly — do **not** add `@ts-expect-error` before them (this tsconfig doesn't error, so the directive becomes an "unused" error).
- The old single-password admin (`ADMIN_PASSWORD`) is replaced by the `users` table; `lib/auth.ts` keeps `isAuthenticated()` for backward-compat.
- Neutralized legacy files under `lib/forms/` are `export {};` (couldn't be deleted on the mount) — don't revive them.

## Reference docs in repo
`PLANO-MULTI-TENANT.md` (multi-tenant design + workspace-switcher UI study), `GOOGLE-ADS-API-SETUP.md` (MCC/OAuth setup), `FASE2-SETUP.md`.
