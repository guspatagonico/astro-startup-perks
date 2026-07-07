# Security Report — StartupPerks

Generated: 2026-07-06 | Tools: Gortex v0.59.1, Gitleaks v8, OSV, manual review

---

## Scope

| Layer | Files | Risk Profile |
|-------|-------|-------------|
| Astro frontend | `src/**/*.astro`, `src/**/*.ts` | Low — static site, no user sessions |
| Submit API (Worker) | `workers/submit-api/src/index.ts` | **Medium** — accepts public POST, creates GitHub PRs |
| Content | `src/content/perks/*.md` | Low — validated via Zod schema |

---

## Findings

### 1. No Rate Limiting on Submit API — MEDIUM

**File:** `workers/submit-api/src/index.ts:22`

The `/api/submit-perk` endpoint has no rate limiting, throttling, or abuse prevention beyond a honeypot field. An attacker could flood submissions, creating thousands of branches and draft PRs on the GitHub repo.

**Impact:** Resource exhaustion (GitHub API rate limits, repository pollution)  
**Recommendation:** Add Cloudflare Workers rate limiting via `wrangler.toml` or a KV-based token bucket. Consider adding a CAPTCHA challenge on the frontend before API call.

---

### 2. Permissive CORS Fallback — LOW

**File:** `workers/submit-api/src/index.ts:95-103`

When `ALLOWED_ORIGIN` env var is not configured, `getCorsHeaders` falls back to `origin || "*"`, which echoes any `Origin` header back. This effectively allows cross-origin POSTs from any domain.

```
const allowOrigin = allowedOrigin || origin || "*";
```

Additionally, the origin enforcement at line 35-37 only activates when `ALLOWED_ORIGIN` is explicitly set:

```
if (env.ALLOWED_ORIGIN && origin && origin !== env.ALLOWED_ORIGIN) {
  return jsonResponse({ ok: false, error: "Origin not allowed." }, 403, corsHeaders);
}
```

**Impact:** Any website can POST submissions to the API. Combined with no rate limiting, this enables CSRF-style flood attacks.  
**Recommendation:** Always set `ALLOWED_ORIGIN` in production. Consider hard-failing if `ALLOWED_ORIGIN` is unset and the request has an `Origin` header.

---

### 3. Missing Content Security Policy (CSP) — LOW

**File:** `src/layouts/BaseLayout.astro` (no CSP header or meta tag)

No `Content-Security-Policy` header or `<meta>` tag is present. The site uses `set:html` for JSON-LD (line 68) and an inline `onclick` handler in `index.astro:238`.

**Impact:** No defense-in-depth against XSS if user content were ever rendered unsafely.  
**Recommendation:** Add a CSP header via Astro middleware or the deployment platform (Cloudflare/Vercel). Example:
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com
```

---

### 4. Dependency Cycle in Worker — INFO

**Tool:** Gortex `analyze --kind cycles`

Cross-community cycle detected (severity 2):

```
getBaseBranchSha → githubRequest → fetch → getBaseBranchSha
```

`getBaseBranchSha` calls `githubRequest`, which is called from `fetch`, and `fetch` calls `getBaseBranchSha`. This is a structural cycle (they are all in the same module, called sequentially not recursively), so runtime impact is minimal.

**Impact:** Low — same-module functions called in sequence, not actual recursion.  
**Recommendation:** No action needed. The cycle exists because `githubRequest` is used by multiple functions called from `fetch`. Refactoring `githubRequest` to not reference the outer scope would eliminate the cycle but isn't critical.

---

### 5. Unsafe Throw Patterns — INFO

**Tool:** Gortex `analyze --kind unsafe_patterns`

Two `throw new Error()` statements detected in the worker:

- `workers/submit-api/src/index.ts:264` — `getBaseBranchSha`
- `workers/submit-api/src/index.ts:329` — `parseGithubResponse`

**Impact:** Minimal. Both are caught by the try/catch in `fetch` (line 84-87) and returned as JSON error responses.  
**Recommendation:** Acceptable pattern for Cloudflare Workers.

---

### 6. Error Message Leakage to Client — LOW

**File:** `workers/submit-api/src/index.ts:84-86`

```
const message = error instanceof Error ? error.message : "Could not create pull request.";
return jsonResponse({ ok: false, error: message }, 502, corsHeaders);
```

GitHub API error messages (from `parseGithubResponse`) are returned directly to the client. If GitHub ever includes sensitive info in error messages (unlikely), this would leak it.

**Impact:** Low — GitHub API errors are generic.  
**Recommendation:** Consider logging the full error server-side (Cloudflare Worker observability is enabled) and returning a generic message to the client.

---

### 7. Honeypot Anti-Spam — GOOD

**File:** `workers/submit-api/src/index.ts:131-133`

```typescript
if (website) {
  return { ok: false, error: "Submission rejected." };
}
```

The `website` field is hidden via CSS (`field-hp` class, positioned off-screen at `left: -9999px` in the modal) and marked `tabindex="-1" autocomplete="off"`. Bots that auto-fill all fields will trigger the rejection. Legitimate users won't see or interact with it.

**Status:** Effective anti-bot measure. No action needed.

---

### 8. Input Validation — GOOD

Multiple layers of validation, all positive findings:

| Function | File:Line | Behavior |
|----------|-----------|----------|
| `validatePayload` | `index.ts:115` | Validates all fields with type checks, length minimums, enum membership |
| `cleanText` | `index.ts:171` | Trims strings, falls back to empty string for non-strings |
| `isValidUrl` | `index.ts:185` | Uses `new URL()` parser, restricts to `http:` and `https:` |
| `toSlug` | `index.ts:194` | Sanitizes to `[a-z0-9-]+` only — path traversal impossible |
| `yamlString` | `index.ts:203` | Escapes `\`, `"`, and newlines for YAML safety |
| Zod schema | `content.config.ts:6` | `.min()`, `.url()`, `.enum()`, `.date()` validation at build time |

---

### 9. Secrets & Credentials — GOOD

- **Gitleaks scan:** No secrets detected in codebase
- **GitHub Token:** Stored as Cloudflare Worker env var (`env.GITHUB_TOKEN`), not in source
- **Token transport:** `Authorization: Bearer` header (standard), not in URL query params
- **No env vars in `wrangler.toml`** — correct, they should be set via `wrangler secret`

---

### 10. PR Creation Safety — GOOD

- PRs are created as **drafts** (`draft: true`, line 306) — no accidental merges
- PR title prefixed with `feat:` conventional commit tag
- Branch names use timestamp-based suffix (`Date.now().toString(36)`) for uniqueness

---

### 11. SAST (Static Analysis) — CLEAN

- **Gortex hygiene scan:** 0 matches (190+ rules across 8 languages)
- **Gortex named queries (hardcoded-secrets, xss, ssrf, command-injection):** 0 matches
- **Gortex dead code:** 0 symbols
- **Gortex env var users:** 0 exposed patterns

---

## Summary

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | No rate limiting on submit API | **Medium** | Needs fix |
| 2 | Permissive CORS fallback | Low | Needs config |
| 3 | Missing CSP header | Low | Recommended |
| 4 | Dependency cycle in worker | Info | Acceptable |
| 5 | Unsafe throw patterns | Info | Acceptable |
| 6 | Error message leakage | Low | Consider |
| 7 | Honeypot anti-spam | — | Good |
| 8 | Input validation | — | Good |
| 9 | Secrets management | — | Good |
| 10 | PR safety (drafts) | — | Good |
| 11 | SAST results | — | Clean |

**Overall risk: LOW.** The project is a static site with a single public API endpoint that creates draft PRs. The primary concerns are DoS via unrate-limited submissions and overly permissive CORS defaults. No secrets, XSS vectors, or injection vulnerabilities were found.
