# AGENTS.md

Repository-level instructions for AI coding agents working on StartupPerks.

## Project intent

- Open-source directory of startup credits/perks.
- Astro + Bun stack.
- Content-first workflow via markdown files in `src/content/perks/`.

## Core commands

- Install: `bun install`
- Dev: `bun run dev`
- Validate/build: `bun run check`
- Production build: `bun run build`

## Implementation expectations

- Keep UI minimal, compact, and accessible.
- Preserve homepage search/filter/sort functionality.
- Preserve submit modal behavior and GitHub prefilled PR flow.
- Keep schemas and content validation aligned with `src/content.config.ts`.

## Content rules

- One perk per markdown file in `src/content/perks/`.
- Use official source URLs when possible.
- Prefer factual wording over promotional wording.
- Mark inactive offers with `isActive: false` instead of deleting history.

## Before finishing

- Run `bun run check`.
- Update docs if behavior, setup, or contribution flow changed.

<!-- gortex:communities:start -->
<!-- gortex:skills:start -->
## Community Skills

| Area | Description | Skill |
|------|-------------|-------|
| Submit Api Src Fetch | 30 symbols | `/gortex-submit-api-src-fetch` |
| Submit Api Src Githubrequest | 30 symbols | `/gortex-submit-api-src-githubrequest` |
| Submit Api Src Validatepayload | 19 symbols | `/gortex-submit-api-src-validatepayload` |
| Astro Anyentrymap | 14 symbols | `/gortex-astro-anyentrymap` |
| Submit Api Src Buildmarkdown | 12 symbols | `/gortex-submit-api-src-buildmarkdown` |
| Astro Livecontentconfig | 11 symbols | `/gortex-astro-livecontentconfig` |
| Components | 9 symbols | `/gortex-components` |
| Components 3 Dirs | 8 symbols | `/gortex-components-3-dirs` |
| Pages | 6 symbols | `/gortex-pages` |
| Submit Api Src Tobase64 | 5 symbols | `/gortex-submit-api-src-tobase64` |
| Pages Perks Truncatetext | 4 symbols | `/gortex-pages-perks-truncatetext` |
<!-- gortex:skills:end -->

<!-- gortex:communities:end -->
