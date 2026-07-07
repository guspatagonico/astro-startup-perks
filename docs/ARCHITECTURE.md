# Architecture — StartupPerks

## Overview

StartupPerks is an open-source directory of startup credits, discounts, and perks. It is a static site with a public submission API that creates GitHub draft PRs.

| Property | Value |
|----------|-------|
| Stack | Astro 5.17 + Bun |
| Rendering | Static (SSG) |
| Content | Markdown files with Zod-validated frontmatter |
| Submit API | Cloudflare Worker (TypeScript) |
| Hosting | Astro static output + Cloudflare Workers |

---

## Directory Structure

```
astro-startup-perks/
├── src/
│   ├── content/
│   │   └── perks/              # One .md file per startup perk
│   ├── components/
│   │   ├── PerkCard.astro      # Perk listing card
│   │   ├── PlaceholderCard.astro # Loading skeleton
│   │   └── SubmitPerkModal.astro  # Submit form + API flow
│   ├── layouts/
│   │   └── BaseLayout.astro    # SEO, OG tags, JSON-LD, ViewTransitions
│   ├── pages/
│   │   ├── index.astro         # Homepage: search, filter, sort
│   │   ├── perks/[slug].astro  # Perk detail page (dynamic routes)
│   │   ├── contributing.astro  # Contribution guide
│   │   └── faq.astro          # FAQ page
│   ├── styles/
│   │   └── global.css
│   └── content.config.ts       # Zod schema for perk frontmatter
├── workers/
│   └── submit-api/
│       ├── src/
│       │   └── index.ts        # Submit API Worker (single file)
│       └── wrangler.toml       # Cloudflare Worker config
├── package.json
├── astro.config.ts
└── tsconfig.json
```

---

## Architecture Layers

### 1. Content Layer

**Location:** `src/content/perks/*.md`  
**Schema:** `src/content.config.ts` (Zod)

Each perk is a Markdown file with YAML frontmatter. Example structure:

```yaml
company: "Stripe"
title: "$50,000 in Stripe Credits"
summary: "Official startup program for Stripe."
perkType: "credit"
amountDisplay: "$50,000"
currency: "USD"
eligibility: "For Seed stage startups..."
fundingStages: ["Seed"]
regions: ["Global"]
categories: ["Payments"]
applyUrl: "https://stripe.com/startups"
sourceUrl: "https://stripe.com/startups"
lastVerified: 2026-07-01
verified: false
isActive: true
```

**Validation:** All fields validated at build time via `z.object()` with `.min()`, `.url()`, `.enum()`, `.coerce.date()` constraints.

**Schema constraints:**
- `company`: min 2 chars
- `title`: min 8 chars
- `summary`: min 24 chars
- `perkType`: enum `credit | discount | trial | mixed`
- `amountDisplay`: min 2 chars
- `currency`: exactly 3 chars, default `USD`
- `eligibility`: min 12 chars
- `categories`: non-empty array, each min 2 chars
- `applyUrl` / `sourceUrl`: valid URLs
- `verified`: boolean, default `false`
- `isActive`: boolean, default `true`

---

### 2. Presentation Layer (Astro SSG)

**Components:**
- `BaseLayout.astro` — Root layout: SEO metadata, OpenGraph, Twitter Cards, JSON-LD structured data, View Transitions, font loading
- `PerkCard.astro` — Card component for the homepage grid
- `PlaceholderCard.astro` — Skeleton loading state
- `SubmitPerkModal.astro` — Modal with submit form and dual-path submission logic

**Pages:**

| Route | Source | Description |
|-------|--------|-------------|
| `GET /` | `index.astro` | Homepage with search, filter by category/stage, sort |
| `GET /perks/{slug}` | `perks/[slug].astro` | Perk detail page (SSG from content collection) |
| `GET /contributing` | `contributing.astro` | Contribution guide |
| `GET /faq` | `faq.astro` | FAQ |

**Homepage (`index.astro`) flow:**

```
init()
├── Load all perks via getCollection("perks")
├── Filter: by category, funding stage, search text
├── Sort: by company name, value, or recently added
├── Render: PerkCard grid
└── Attach: SubmitPerkModal
```

---

### 3. Submit API (Cloudflare Worker)

**Endpoint:** `POST /api/submit-perk` (also serves `/` and `/submit-perk`)  
**File:** `workers/submit-api/src/index.ts` (342 lines)

#### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `GITHUB_TOKEN` | Yes | GitHub PAT for API calls |
| `GITHUB_REPO` | Yes | Target repo (e.g. `owner/repo`) |
| `GITHUB_BASE_BRANCH` | No | Base branch for PR (default: `main`) |
| `ALLOWED_ORIGIN` | No | CORS allowlist |

#### Request Flow

```
POST /api/submit-perk
  │
  ├─ 1. CORS preflight (OPTIONS → 204)
  │
  ├─ 2. Path check (isAllowedPath)
  │
  ├─ 3. Origin check (if ALLOWED_ORIGIN set)
  │
  ├─ 4. Method check (POST only)
  │
  ├─ 5. Token check (GITHUB_TOKEN + GITHUB_REPO present)
  │
  ├─ 6. JSON parse (request.json())
  │
  ├─ 7. Validate payload
  │     ├── cleanText()      → trim strings
  │     ├── normalizeStringArray() → flatten or wrap arrays
  │     ├── isValidUrl()     → new URL() + protocol check
  │     └── Honeypot check   → reject if "website" field filled
  │
  ├─ 8. Build branch name
  │     ├── toSlug(company) → [a-z0-9-]+
  │     └── branchName = submission/{slug}-{timestamp36}
  │
  ├─ 9. Build markdown
  │     ├── yamlString() → escape \, ", \n
  │     └── buildMarkdown() → YAML frontmatter + body
  │
  ├─ 10. GitHub PR creation
  │      ├── getBaseBranchSha()   → GET /git/ref/heads/{branch}
  │      ├── createBranch()        → POST /git/refs
  │      ├── createPerkFile()      → PUT /contents/{path} (base64)
  │      └── createPullRequest()   → POST /pulls (draft: true)
  │
  └─ 11. Return { ok: true, prUrl }
```

#### GitHub API Communication

All GitHub calls go through `githubRequest()` which:
- Adds `Authorization: Bearer {GITHUB_TOKEN}`
- Sets `Accept: application/vnd.github+json`
- Sets `User-Agent: startup-perks-submit-api`
- Routes through `parseGithubResponse()` for error handling

---

### 4. Submission Paths (Dual Strategy)

The submit modal supports two paths:

#### Path A: Direct API (production)

1. User fills form in `SubmitPerkModal`
2. Form data serialized as JSON
3. `POST` to `submissionApiUrl` (Cloudflare Worker)
4. Worker validates → creates GitHub draft PR
5. Returns `{ ok: true, prUrl }`
6. Client opens PR URL in new tab

#### Path B: GitHub Web Flow (fallback)

1. User fills form
2. Client-side builds markdown via `createMarkdown()`
3. Builds GitHub URL: `https://github.com/{repo}/new/{branch}/src/content/perks?filename=...&value=...`
4. Opens pre-filled GitHub file creation page in new tab
5. User manually submits PR through GitHub UI

**Selection logic:** If `submissionApiUrl` is configured → Path A. Otherwise → Path B.

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    STATIC SITE (Astro)                   │
│                                                         │
│  index.astro          perks/[slug].astro                │
│  ┌──────────┐         ┌──────────────────┐             │
│  │ Search   │         │ Detail Page      │             │
│  │ Filter   │◄────────│ Markdown body    │             │
│  │ Sort     │         │ Schema validated │             │
│  └────┬─────┘         └────────┬─────────┘             │
│       │                        │                        │
│       │    getCollection()     │                        │
│       └────────────┬───────────┘                        │
│                    │                                    │
│              ┌─────▼──────┐                             │
│              │ content/   │                             │
│              │ perks/*.md │                             │
│              └────────────┘                             │
│                                                         │
│  SubmitPerkModal.astro                                  │
│  ┌──────────┐                                          │
│  │ Form     │──► Path A: POST /api/submit-perk ──┐     │
│  │ Handlers │──► Path B: github.com/new/... flow  │     │
│  └──────────┘                                     │     │
└───────────────────────────────────────────────────┼─────┘
                                                    │
┌───────────────────────────────────────────────────┼─────┐
│              CLOUDFLARE WORKER                     │     │
│                                                    │     │
│  POST /api/submit-perk ◄───────────────────────────┘     │
│  ┌──────────────────────┐                                │
│  │ fetch()              │                                │
│  │  ├─ CORS headers     │                                │
│  │  ├─ validatePayload()│                                │
│  │  ├─ buildMarkdown()  │                                │
│  │  ├─ getBaseBranchSha()──┐                             │
│  │  ├─ createBranch()      │                             │
│  │  ├─ createPerkFile()    │                             │
│  │  └─ createPullRequest() │                             │
│  └──────────┬──────────────┘                             │
│             │                                            │
│      githubRequest()                                     │
│      ┌──────▼──────┐                                     │
│      │ GitHub API  │                                     │
│      │ api.github. │                                     │
│      │ com/repos/* │                                     │
│      └─────────────┘                                     │
└──────────────────────────────────────────────────────────┘
```

---

## Security Model

| Concern | Mitigation |
|---------|-----------|
| Spam submissions | Honeypot field (`website`), PRs created as drafts |
| Path traversal | `toSlug()` restricts to `[a-z0-9-]+` |
| URL injection | `isValidUrl()` validates protocol (http/https only) |
| YAML injection | `yamlString()` escapes `\`, `"`, newlines |
| XSS (client) | Uses `textContent`, not `innerHTML` |
| Secrets exposure | Token in Cloudflare env vars, not source code |
| CSRF | `ALLOWED_ORIGIN` CORS check (when configured) |
| Rate limiting | Not implemented (see SECURITY_REPORT.md) |

---

## Community Structure (Gortex Analysis)

The codebase auto-partitions into these functional areas:

| Community | Hub | Size | Purpose |
|-----------|-----|------|---------|
| submit-api/src · fetch | `fetch` | 30 symbols | Request orchestration, CORS, response handling |
| submit-api/src · githubRequest | `githubRequest` | 30 symbols | GitHub API communication layer |
| submit-api/src · validatePayload | `validatePayload` | 19 symbols | Input sanitization and validation |
| submit-api/src · getBaseBranchSha | `getBaseBranchSha` | 15 symbols | GitHub branch/ref operations |
| components | `setupModal` | 9 symbols | Modal UI and form submission logic |

---

## Key Design Decisions

1. **Content-first:** Perks are plain Markdown files. The site is a viewer, not a CMS.
2. **Dual submit path:** Direct API when available, GitHub web flow as fallback — no backend required for self-hosted instances.
3. **Draft PRs:** All automated submissions create draft PRs. Human review required before merge.
4. **YAML string escaping:** Both client (`SubmitPerkModal`) and server (`buildMarkdown`) independently escape YAML values — defense in depth.
5. **No auth on submit API:** Public by design since PRs are drafts and require human review.
6. **Zod schema:** Content validation at build time via Astro content collections. Same schema enforced in worker-side validation.

---

## Configuration Surface

| Config | How | Default |
|--------|-----|---------|
| Perk schema | `src/content.config.ts` (Zod) | — |
| Astro settings | `astro.config.ts` | — |
| Worker env vars | Cloudflare Dashboard / `wrangler secret` | — |
| Worker config | `workers/submit-api/wrangler.toml` | — |
| Submission API URL | Frontend prop `submissionApiUrl` | Empty (uses GitHub flow) |
| Repository URL | Frontend prop `repositoryUrl` | Empty |
| Base branch | Frontend prop `baseBranch` | `main` |
