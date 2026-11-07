# Cia AI archive — visual and interaction QA

Date: 2026-11-06. Local implementation: http://127.0.0.1:5173/work/cia-ai.

## Visual truth and evidence

- User reference: Bilibili BV1jebG6zE1E; inspected its playback and the linked [RhineLabUI demo](https://rhine.lubeiluchen.cc/) and [MIT source](https://github.com/LBEILC/RhineLabUI).
- Source capture: `qa/cia-rhine-20261105/reference-archive.png`, 1280 × 720, archive overview.
- Implementation: `qa/cia-rhine-20261106/archive-final-full.png`, browser capture 1265 × 779. CSS viewport was 1280 × 788, DPR 1; stage starts at y=68 and measures 1265 × 720, excluding the browser scrollbar. The screenshot provider scaled the image; normalize it back to 1280 × 788 before cropping the stage.
- Actual side-by-side input reviewed: `qa/cia-rhine-20261106/comparison-final.jpg`. Each panel is 1265 × 720; source horizontally normalized from 1280 to 1265. Portfolio header and browser scrollbar excluded from this comparison.
- Focused file heading, line, copy and access control comparison: `qa/cia-rhine-20261106/comparison-controls.jpg`.
- Additional browser evidence: `detail-final-full.png`, `mobile-archive.png`, `mobile-detail-top.png`, `mobile-detail-reading.png`, `tablet-en.png`, `tablet-ja.png` in that same directory.
- Early `archive-before.png`, `archive-revised.png` and their comparison images came from a capture API that produced an incorrect narrow layout. They are diagnostic artifacts, not valid fidelity evidence. Final evidence uses the browser's actual screenshot surface.

## Comparison history and resolved findings

1. Initial browser inspection: P1 global footer CSS filled the archive controls with acid yellow; P1 the flat array did not have the reference's raised selected column; P2 guide avatar was clipped and its proactive note covered controls. Replaced the internal footer element with a neutral div, adapted the licensed reference's settled shoulder/framing, refined material/fog treatment, and corrected the compact avatar. Only this showcase suppresses the proactive note; its named chat button remains available.
2. Follow-up visual comparison: corrected identity/selection vertical placement and top/bottom visual fade. The final combined full-view and focused evidence above confirms an ivory array, raised selected cassette, top identity/search, right-side file information and separate bottom navigation without the yellow slab or blocked controls.
3. Interaction audit: fixed Up/Down in the reading document switching files, and allowed modified Home/End shortcuts to retain native behavior. The final opening curtain previously extended beyond its JS lifetime; the finite sequence now ends at 2800 ms, after all curtains finish. A scene-local error boundary preserves text/navigation if the lazy WebGL import fails.
4. Mobile: moved the extracted model below the navigation; body scrolls naturally, with the document and navigation remaining reachable. At 390 × 844, scrollWidth=375 with the browser's 15 px scrollbar; no horizontal overflow. At 1024 × 768, English/Japanese reading and controls remain available. Dense detail views intentionally have a local reading scrollbar.

## Required fidelity surfaces

- Typography: compact Arial identity, static file heading and monospaced metadata preserve the reference hierarchy. Cia's Chinese/English/Japanese headings and content replace franchise text; larger Chinese body labels are intentional for readability. No typing/decryption text.
- Spacing/layout: full-width array, small upper-corner controls, selected file near the right-center, bottom real 1/6 selector, and left-object/right-document extraction follow the reference structure. Shared PHRNONO navigation and a character link remain product requirements. Mobile switches to a vertical reading layout.
- Color: warm ivory, dark gray, fine neutral dividers, faint material shadows, restrained acid accent only on the selected object/brand affordances. The original full-width yellow footer bleed is gone.
- Image quality: uses actual attributed 3D geometry, not a screenshot background or CSS substitute. The upstream lettering/logo groups were physically removed. The selected cassette retains transmission and inner optics; mobile background shells are opaque and omit tiny instanced fasteners. Shadows/optical finish are a lighter rendering adaptation, not a claim of pixel-for-pixel parity with upstream AO/depth-of-field.
- Copy: six real local-app capability summaries, meaningful examples, and explicit scope in three languages. Search filters those six files; bookmarks last only while the mounted page remains open. No invented stats, functioning cloud demo, unrestricted PC authority or new character canon.

## Verified interactions and technical checks

- Open/read/back; six selection buttons; previous/next; search for 代码 returns the coding file; unmatched query displays the empty state.
- Final independent browser session also verified pointer-drag rotation of the extracted cassette (`detail-rotated.png`) and return to the array. Final console warning/error list is empty; `delivery-preview.png` records the restored default 1280 × 720 viewport.
- Save coding file, filter current-visit bookmarks, and confirm the same selected record is listed. Reload resets this page-only collection.
- Overview/example/scope tabs; arrow-key tab navigation; document ArrowDown keeps the same file; Escape closes search and restores its trigger.
- Replay exposes the opening and Skip returns immediately to the archive. Reduce-motion changes the visible state and disables replay; CSS and WebGL both use that state. OS preference listener is also present (source-audited, not OS-toggle tested).
- Chinese, English and Japanese; desktop 1280 × 788, tablet 1024 × 768, mobile 390 × 844. No horizontal overflow in DOM measurement. Character links are fixed to `/character-design#cia`; their destination data is covered by the existing tests.
- Source review: finite RAF stops when settled, hidden, offscreen or when the index dialog is open; instance transforms are reused and skip unnecessary recomputation; listeners, fetch, GPU buffers/materials and renderer are disposed. This is not a real-device FPS/thermal benchmark.
- Production Vite build passed; Sites packaging prepared; required four-file suite: **84/84 passed**, 0 failed/skipped. Vite warns about the Three.js lazy chunk (~639 kB / 163 kB gzip) and existing main chunk size; the 3.12 MB model is fetched only on this project route.
- Earlier development console warnings for obsolete PCFSoftShadowMap and an intermediate hot-reload syntax error were corrected. Fresh final-session console check is recorded in `browser-checks.json`; do not attribute old development logs to the final build.
- WebGL error fallback and lazy-import boundary were source-audited; actual hardware context loss/offline failure was not forced in this browser session. iPad Safari hardware was not available for native-device testing.

## Intentional differences and follow-up polish

PHRNONO/Cia identity, capability content, six files, native portfolio header, character navigation, current-visit bookmarks, reduced-motion controls and the vertical mobile reading view are intentional. The source's franchise labels/audio and continuous animated background are not included. A more expensive ambient-occlusion/depth-of-field treatment may be considered later after real-device profiling; the current finite scene keeps the same archive composition and extraction interaction.

No actionable P0/P1/P2 issue remains in the tested adaptation. No production publication occurred in this redesign phase.

final result: passed
