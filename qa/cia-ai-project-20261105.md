# Cia AI portfolio project — 2026-11-05

Owner confirmed a portfolio overview and character-design link after stopping the proposed live model connection. Later requested more animation on the new page. This work presents the Windows local app; it does not expose it to visitors.

## Implemented

- `/work/cia-ai`, lazy-loaded page with Chinese, English and Japanese copy and metadata.
- Static work entry in `INTERACTIVE`; localized category and original vector interface-study cover. Category hash survives the return link and reload. Existing three case-study seeds remain first.
- Six capability descriptions based on the local project's implemented scope: dialogue/images, code drafts/parsing, permitted lookup, limited desktop assistance, confirmed local notes, visible task feedback.
- Two fixed character CTAs to `/character-design#cia`. Explicit guide navigation distinguishes the AI project from the character and rejects ambiguous/negated/private/URL requests.
- Finite identity/block entrance, sheet assembly, connecting-line draws, four tool-cell registrations, result reveal, scroll-triggered capability rows, focus sheet and link feedback. Text is never scrambled or typed character by character. The diagram is explicitly an interface study, not a running task.
- Animation arms only after the existing intro/route cover has ended. Each intersecting target is unobserved once revealed. Observer and media-query listener disconnect on cleanup. Reduced motion renders static content; keyboard focus immediately reveals content. No looping task/progress claims, network calls or new packages.

## Validation

Command from this directory, using the existing D-drive Node runtime:

```powershell
& '..\..\Cia AI\runtime\node.exe' --test tests/sites-worker.test.mjs tests/admin-operations.test.mjs tests/cia-guide.test.mjs tests/character-archive.test.mjs
& '..\..\Cia AI\runtime\node.exe' node_modules/vite/bin/vite.js build
& '..\..\Cia AI\runtime\node.exe' scripts/prepare-sites-build.mjs
```

- **84/84 tests pass**, zero failed/skipped, 393.237 ms. Includes three new navigation behavior cases. Pure guide test run separately passed 21/21; do not add these as distinct tests.
- Final production build after animation and opening-gate changes succeeds in 8.11 seconds. Required `dist/client/index.html`, `dist/server/index.js`, `dist/.openai/hosting.json` produced. Existing main-bundle >500kB advisory remains; no budget was changed to hide it.
- Actual in-app browser preview at `http://127.0.0.1:5173/work/cia-ai`. Default desktop viewport reported innerWidth1525/scrollWidth1510. At 390×844, innerWidth390/scrollWidth375, no horizontal overflow, no broken images. This was browser QA, not an iPad/Electron acceptance test.
- Actual clicks: return to `/work#category-interactive` selects AI category with one project; project card opens overview; character CTA opens `/character-design#cia` with Cia selected. Chinese→English→Japanese switches update visible copy, document language and localized title; restored Chinese.
- Reload captured distinct actual intermediate assembly frames. Scroll brought all six rows into the revealed state. The final page is settled; normal viewport restored. No OS-level reduced-motion setting was changed; reduced-motion behavior has source/CSS coverage, not a claimed live OS toggle test.
- Final browser warning/error logs returned `[]`. An earlier checkbox locator did not match the page's native representation; the same visible control worked with its current accessibility index. No application error was observed.

Screenshots: [desktop](cia-ai-desktop-20261105.jpg), [phone](cia-ai-mobile-20261105.jpg), [early assembly](cia-ai-motion-early-20261105.jpg), [later assembly](cia-ai-motion-late-20261105.jpg). Intermediate images cover only the sampled portion, not a complete video/performance benchmark. Phone screenshot retains the existing floating guide/note.

## State and limits

At the initial local-preview handoff, this was not a confirmed production publication. Existing Sites connector has no PHRNONO project, so it was not used to create a replacement site. Existing dirty worktree and unrelated changes were preserved. The later owner-requested production release is recorded below.

`INTERACTIVE` is a static seed category; owner CMS category editing was not expanded. Local AI runtime, weights, training data, story and character artwork are unchanged. No model process was started. The loopback-only Vite preview remains in the retained session for the user's open preview; it is not an AI service or internet tunnel.

Claude handoff updated at `D:/3D__Game Design__Java/Cia AI/CLAUDE_HANDOFF.md`.

## Production release — 2026-11-05

After the owner requested `push`, site source was committed and pushed as `39fd53c08b58650881de9d5de63622f22e98d773`. A repeated `push` continued to the existing Cloudflare Worker because the live site still served the previous bundle.

- Reused the existing official Wrangler4.149.0 CLI and existing authorized OAuth session; no package install or new login. Diagnostic/temp output directed to ignored D-drive `tmp/cloudflare-release-20261105/`.
- Read the previous deployed version `7190e030-5f32-4216-b540-7e8f9629cec0` binding inventory; local config accounts for its AI/assets/D1/R2/three DO bindings. Existing secret and plain-text bindings retained through `keep_vars:true`; no credentials were displayed or replaced. No database migration, namespace deletion, DNS edit or local AI exposure was performed.
- `wrangler deploy --dry-run` succeeded. Actual deploy uploaded six changed assets, reused482 existing assets and published the `phrnono` Worker with version **12851248-4859-4e08-94eb-403b186a3dc1**, including the existing custom domain.
- Post-release HTTP verification: `https://phrnono.com/work/cia-ai` returns200 and references `index-DkiziI0B.js`; the served bundle contains `/work/cia-ai`; the served project CSS contains `cia-flow-unfold`. All16 existing binding names remain present in the deployed version. This is deployed asset/routing verification; the earlier browser screenshots remain local visual evidence, not newly captured production screenshots.

Published project: https://phrnono.com/work/cia-ai
