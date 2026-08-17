# Design QA

## Comparison target

- Source visual reference: `D:\3D__Game Design__Java\Web Design\source-captures\frame-17.jpg`
- Local implementation: `http://localhost:4173/`
- Desktop viewport: `1280 × 720` CSS px at device scale factor 1.
- Mobile viewport: `390 × 844` CSS px at device scale factor 1.
- Reference use: layout density, typography, palette, motion, and interface rhythm only. Franchise characters, logos, and artwork were not copied.

## Visual evidence

- Home: `qa/desktop-home.png`
- Work: `qa/desktop-work.png`
- Character design: `qa/desktop-character-design.png`, `qa/mobile-character-design.png`
- Route transition: `qa/desktop-route-transition-leaving.png`, `qa/desktop-route-transition-arriving.png`
- Scroll expansion: `qa/desktop-scroll-expand-rest.png`, `qa/desktop-scroll-expand-open.png`
- Detail page: `qa/desktop-detail-food-stall-full.png`
- Pixel Environment mobile detail: `qa/mobile-detail-pixel-environment-full.png`
- Custom 404: `qa/desktop-404.png`
- Mobile home, menu, and work: `qa/mobile-home.png`, `qa/mobile-menu.png`, `qa/mobile-work-full.png`
- Reference comparisons: `qa/reference-vs-home.png`, `qa/reference-vs-work.png`, `qa/reference-vs-character-design.png`, `qa/reference-vs-route-transition.png`, `qa/reference-vs-scroll-expand.png`, `qa/reference-vs-detail.png`, `qa/reference-vs-404.png`
- Open Graph preview: `public/og-phrnono.png` at `1200 × 630`.

The paired comparisons preserve the reference's compressed editorial type, white-first industrial panels, black image fields, technical line work, modular navigation, and restrained acid-yellow accent. PHRNONO's supplied mascot and verified ArtStation images replace all franchise content.

## Fidelity checks

- `PHRNONO` stays on one line at desktop and 390 px mobile widths.
- The homepage contains no project grid; portfolio content remains on `/work`.
- Character Design opens as the local `/character-design` page, contains Lumina's confirmed story and four design notes, and exposes no ArtStation link.
- The local Lumina video has native controls and does not autoplay.
- The story source is the confirmed `Black and Green Hand Drawn Illustration Story Presentation.pdf` only.
- Mobile accordion labels remain visible on collapsed panels.
- Pixel Environment fits at 390 px with document and heading `scrollWidth` equal to their available widths.
- Three project detail routes use published ArtStation assets and show software, time, role, and year.
- Missing wireframe, material, lighting, and process-pass assets are explicitly marked as not published instead of being invented.
- Food Stall and Coffee Grinder expose their verified Sketchfab model links.
- Sound is opt-in, defaults off, persists after reload, and starts only after user input.
- The animated mascot 404 supports reduced motion and links back to Home and Work.
- Chinese, English, and Japanese each contain 206 matching translation keys.

## Interaction and accessibility checks

- ShapeGrid render and pointer response.
- LineSidebar route state and navigation.
- Accordion hover, keyboard focus, local detail links, and external ArtStation links.
- Character Design gallery navigation resolves to `/character-design` with no new tab or external redirect.
- First-entry animation, internal-link page transitions, and LineSidebar transitions all preserve an inert page shell until the overlay clears.
- Case-study tab selection, arrow-key behavior, and active tab-panel linkage.
- Mobile menu state, Escape behavior, and focus restoration after language switching.
- Language, document metadata, CV download, email link, and sound persistence.
- No horizontal overflow at 1280 px or 390 px.
- No broken images, console errors, or page errors.
- Reduced-motion emulation reports zero document animations, skips route overlays, and has no autoplay media.

## Verification

- Production build: passed, 4,988 modules transformed.
- Sites worker tests: 4 passed, 0 failed.
- i18n parity: zh/en/ja each 206 keys, no missing or extra keys.
- Headless Edge visual QA: passed across Home, Work, Character Design, ScrollExpand, route transitions, three detail routes, 404, mobile, and reduced-motion states.

## Non-blocking follow-up

- When a production domain is chosen, replace relative Open Graph image paths with absolute HTTPS URLs.
- The static SPA fallback displays the custom 404 correctly, but unknown routes return HTTP 200 until the hosting layer is configured for true 404 responses.

final result: passed
