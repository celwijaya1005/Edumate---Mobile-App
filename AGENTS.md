# Edumate — Project Context for AI Agents

This file gives any AI coding agent (Antigravity, Claude Code, etc.) working
in this repo the full context of the project, so it doesn't have to guess
or rediscover decisions that have already been made. Read this fully before
making changes.

## Current Status: Rebuild in Progress

Mobile app is being rebuilt from scratch with a new UI (Stitch AI
screenshots, provided separately) and must connect directly to real
Supabase data from the start — no dummy/mock arrays for anything with a
real table. Build in phases; don't jump ahead unless told to:
1. Setup & Auth (`lib/supabase.ts`, Login & Register wired to real Auth)
2. Home & browse modules (real `modules`/`categories` data)
3. Module detail & quiz (`module_contents`/`quiz_questions`, write to
   `quiz_attempts`)
4. Mentor & booking (`mentor_profiles`, write to `mentor_bookings`)
5. Profile, vouchers, mentor verification screens

## What Edumate Is

Edumate is a mobile learning app (school PjBL project) connecting Students
(Murid) with Mentors. Students learn through self-paced modules (content +
quiz) and can book paid 1-on-1 sessions with mentors when they need help.
Gamification (EXP, levels, discount vouchers) motivates students.

## Tech Stack

- **Mobile app**: React Native + Expo (Expo Router, file-based routing),
  TypeScript
- **Backend**: Supabase (Postgres, Auth, Storage). Auth handled entirely by
  Supabase's built-in `auth.users` — never add a `password` column anywhere
  in `public` schema.
- **Mentor content management**: a SEPARATE website/dashboard (not yet
  built) — NOT part of the mobile app. See "Critical Constraints" below.
- **Icons**: `@expo/vector-icons` (Ionicons, MaterialCommunityIcons)
- **Language of all in-app UI text**: Indonesian. Code, comments, and
  variable names are in English as usual, but anything a user reads on
  screen must be Indonesian.

## Project Structure (mobile app)

```
app/
├── (auth)/{_layout,login,register}.tsx
├── (tabs)/                    -- Student's bottom nav
│   ├── {_layout,index,explore,mentor,profile}.tsx  (index=Home, mentor=browse)
├── modules/[id].tsx           -- Module detail + content reading + quiz gate
├── quiz/[id].tsx              -- Quiz + result screen
├── mentors/[id].tsx           -- One mentor's public profile
├── booking/[id].tsx           -- Book a session with a mentor
└── _layout.tsx                -- Root stack; every new top-level route
                                   (outside (auth)/(tabs)) MUST be added
                                   here with headerShown:false, or you'll
                                   get a duplicate header bug we've hit
                                   before.

constants/
├── brand.ts   -- App's own palette (COLORS, PRIMARY_BUTTON_SHADOW). USE
│                 THIS for all Edumate UI colors.
└── theme.ts   -- Expo Router's DEFAULT template file (Colors.light/dark,
                  Fonts). DO NOT touch/repurpose for brand colors — used
                  by default tab bar/themed components. We already broke
                  the app once by overwriting it; add new files instead
                  of overwriting files you didn't create.

lib/supabase.ts  -- Supabase client init (url + anon key)
```

## Design System

- Background `#FDF7F4` (cream), primary/accent `#FF6B57` (coral) for
  buttons/active tab/highlights, text dark `#2D3748`, text light
  `#718096`
- Cards: white, large rounded corners, soft shadow, 1px `COLORS.border`
  (#E2E8F0). Primary buttons: coral bg, white bold text, rounded, use
  `PRIMARY_BUTTON_SHADOW` from `constants/brand.ts`. Avatars circular
  with white border. Ratings: gold star + number + review count.
- Rebuild uses a NEW Stitch-generated visual design (screenshots
  provided by user) — match that layout/spacing/imagery, but keep the
  COLORS palette above unless told the palette itself changed.
- Any header/back button MUST render OUTSIDE the `<ScrollView>` (sibling
  before it, not first child inside) — hit this bug twice already
  (header scrolling away). Same for any bottom action bar: absolutely
  positioned `View` outside scroll content.

## Critical Constraints (don't violate without asking the user)

1. **Mentors don't upload/edit modules from the mobile app** — that's
   web-only (dashboard not yet built). Mobile only lets a verified
   mentor VIEW module status (published/pending/rejected), never a
   create/edit form.
2. **No comments on modules.** Ratings exist only for MENTORS (1-5
   stars + optional comment), given only after a student has completed
   a paid session with that mentor. Modules have no rating/comment.
3. **Mentor registration requires eligibility review**, separate from
   per-module approval:
   - After "Daftar sebagai Mentor", upload docs into
     `mentor_verification_documents` (KTP, ijazah/sertifikat_keahlian,
     optionally portofolio). CV/bio text goes in
     `mentor_profiles.curriculum_vitae`.
   - Each document has its own `status` (pending/approved/rejected) —
     reviewed per document, not one blanket mentor status.
   - `mentor_profiles.is_verified` + `verified_at`/`verified_by`
     reflect the overall outcome once admin has reviewed.
   - While unverified: can log in/browse, but can't open booking slots,
     doesn't appear in mentor search, can't manage modules.
   - Rejected docs show the reason and can be re-uploaded without
     re-registering.
   - Different from per-module approval (still separate, on the
     website, every module submission).
4. **Quiz gated behind reading module content** — "Mulai Kuis" stays
   locked until user scrolls to the bottom of the content. Never
   directly reachable.
5. **Students never need admin approval** — register → verify email →
   full access immediately.
6. **Sessions may include a video call** — `mentor_bookings.meeting_link`
   holds the link; surface it in booking confirmation/session screens
   when present.

## Database (Supabase Postgres)

Table names use `profiles` (not `users`) for the public profile table,
since `auth.users` is Supabase's own internal table — an ERD reviewed
later used "users" as a label, but the actual table stays `profiles`.
13 tables: `profiles`, `categories`, `modules`, `module_contents`,
`quizzes`, `quiz_questions`, `quiz_attempts`, `vouchers`, `user_vouchers`,
`mentor_profiles`, `mentor_verification_documents`, `mentor_bookings`,
`payments`.

Notable fields/naming (confirmed against the latest ERD — use these
exact names, they differ from earlier drafts of this schema):
- `profiles.role` is an enum: `student` | `mentor` | `admin`
- `mentor_profiles`: includes `curriculum_vitae` (bio/CV text),
  `is_verified` (bool), `verified_at`, `verified_by` (FK to profiles)
- `mentor_verification_documents`: `id_document` (PK), `id_mentor_profile`
  (FK), `document_type` (`ktp` | `ijazah` | `sertifikat_keahlian` |
  `portofolio`), `file_url`, `status` (`pending` | `approved` |
  `rejected`), `uploaded_at`, `reviewed_by` (FK), `reviewed_at`
- `mentor_bookings`: includes `meeting_link` (video call link for the
  session)
- `vouchers`: expiry field is named `expired_at` (not `expires_at`)
- `payments`: total field is named `total_amount` (not `amount`)
- There is no `reports` table and no `comments` table in the current
  schema — don't recreate either.
- A Postgres trigger (`handle_new_user`) auto-inserts into `profiles` on
  every `auth.users` signup, reading `role` from the signup's
  `raw_user_meta_data`.
- RLS is enabled on all tables with policies already written (see
  `database/` folder): students can read published modules (or their own
  if they're the mentor), everyone can read/write their own bookings,
  vouchers, quiz attempts, etc. Check existing policies before assuming
  a query will fail or succeed.
- Full schema SQL and the ERD (`.drawio` + `.png`) are already in the
  project — check the `database/` and `diagrams/` folders before
  redesigning anything from scratch. If what you find there conflicts
  with this file, this file (AGENTS.md) reflects the most recent
  decisions — flag the conflict to the user rather than silently picking
  one.

## App Flow (don't skip any of this when building screens)

**Student:** Login/Register (role card: Murid/Mentor) → email
verification → full access. Home (greeting, search, category filters,
"Continue Learning", "Featured Modules") → Module Detail (mentor info,
scrollable content) → quiz unlocks after reading → Quiz (MCQ one at a
time) → Result (score, pass/fail vs passing_score, AI feedback, EXP if
passed) → EXP levels up → level-up grants a discount voucher.
Separately: Mentor tab → search mentors → Mentor Profile (rating,
stats, bio, popular modules, price) → "Jadwalkan Sesi" → Booking (date,
time slot, voucher code, price summary) → Payment method → Booking
Confirmed (surface `meeting_link` once available). AFTER the session
completes, student can rate that mentor (1-5 stars + optional comment)
— the only rating flow in the app. Profile tab: account info,
level/EXP, history (modules, bookings, payments, ratings given), My
Vouchers.

**Mentor:** Register as Mentor → mandatory "Lengkapi Data Kelayakan
Mentor" (uploads go into `mentor_verification_documents`: KTP,
sertifikat_keahlian/ijazah, optionally portofolio; CV/bio text into
`mentor_profiles.curriculum_vitae`) → documents reviewed individually
by admin (pending/approved/rejected per document) → once approved,
`mentor_profiles.is_verified` becomes true → "Terverifikasi". Rejected
documents loop back to re-upload. Verified mentor's mobile app gives:
Dashboard (summary stats), My Modules (status-only list), My Schedule
(incoming bookings incl. `meeting_link`), Manage Mentor Profile (public
bio/expertise/rate — different from eligibility docs), payment
history, ratings received. Module creation/editing is web-only.

## Where to Find More Detail

- `database/edumate_schema.sql` — base schema (13 tables)
- `database/edumate_schema_patch_v2.sql` — RLS policies patch (note:
  this patch's approach to mentor verification via inline columns on
  `mentor_profiles` was SUPERSEDED by the `mentor_verification_documents`
  table described above — use the documents table, not
  `id_card_url`/`certificate_url` columns, if you see both referenced)
- `diagrams/erd_edumate.drawio` / `.png` — entity relationship diagram
- `diagrams/usecase_edumate.drawio` — use case diagram (Student/Mentor
  actors split, shared Login/Kelola Profil)
- `activity_diagram_edumate.drawio` — 8 activity diagrams covering
  registration/role choice, mentor eligibility verification, login,
  student learning + quiz, mentor upload/approval (web), booking +
  payment, session completion, and rating a mentor

## Working Conventions

- When adding a new top-level route file, always register it in the
  root `app/_layout.tsx` Stack with `headerShown: false` (unless you
  want the default header).
- Reuse `COLORS` and `PRIMARY_BUTTON_SHADOW` from `constants/brand.ts`
  rather than hardcoding hex values in new screens.
- This rebuild wires real Supabase queries — don't leave
  `// DUMMY DATA` placeholders for tables that already exist in the
  schema; only use placeholders for something genuinely not built yet
  (e.g. a feature with no table at all).
- Don't rename or restructure existing decisions (table names, route
  names, color values) without flagging it to the user first — a lot of
  back-and-forth already went into settling these.