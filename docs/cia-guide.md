# Cia archive guide

The public guide is one fictional Cia persona for both PHRNONO website questions
and approved character-canon questions. It uses the existing Cloudflare Workers
AI binding with `@cf/zai-org/glm-4.7-flash`; provider access remains server-side.

## Grounding and voice

`worker/ciaGuideKnowledge.js` includes the immutable core boundaries and derives
public identity/ability records, Lumina's approved story, and project names from
the same source files used by the website. Questions select a small number of
existing Chinese reading-edition excerpts; the optional addition is bounded to
2,500 characters. Prior chat is conversational context, never evidence of new
canon. Missing details must be acknowledged rather than invented. The character
and story source files are not rewritten by this feature.

Cia speaks simply and warmly. The UI and direct identity answers identify this
as a fictional AI guide, not a real person. Neither her personality nor proactive
notes imply that she needs a visitor to stay or remembers another visit.

## Navigation and language

`src/ciaGuideLanguage.js` chooses the response language from an explicit language
request, Chinese/Japanese text or a recognizable English message. Ambiguous short
follow-ups may use a recent visitor turn; the page locale is the final fallback.
Navigation acknowledgements use the same function.

`src/ciaGuideNavigation.js` recognizes explicit, unambiguous requests and returns
only existing public destinations. The model never executes navigation or
supplies executable URLs. Lore questions, negated requests, multiple targets,
arbitrary URLs and private admin requests stay in the conversation. Character
story links use `/character-design?tab=story#cia` or `#lumina`. Changing tabs keeps
the URL accurate without adding a new history entry for every tab.

## Bounds and privacy

- The browser holds chat in React memory only. Full-page navigation or refresh
  clears it; no transcript is saved to browser storage, D1, or analytics.
- Only the newest four valid turns are sent, at most 600 characters each and
  4,200 serialized UTF-8 bytes total. The visible messages stay complete.
- Requests remain bounded to 8 KiB and the current visitor message to 900 chars.
- The rate-limit key is an opaque HMAC rotated by the ten-minute window. The
  provider receives no stable client `user` identifier. Expired count records
  are removed; raw identifying request information is not stored with chat.
- The Worker times out waiting for inference after 15 seconds; the UI also
  recovers after 20 seconds. There is no automatic retry or second AI call.
  A timeout cannot cancel inference already accepted by the provider.

## Free allocation

The existing safeguards allow 12 requests per client window and 180 site-wide
inference attempts per UTC day. The latter is a conservative demand ceiling,
not a reservation of account-wide free quota. Cloudflare's free allocation is
shared across the account; other workloads may consume it first. When it is
exhausted, the guide explains the limit and the 08:00 Taipei / 00:00 UTC reset.
It does not automatically enable paid billing or switch to a paid provider.

Official model and allocation documentation:
- https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/
- https://developers.cloudflare.com/workers-ai/platform/pricing/

Run `npm run test:sites` for Worker, guide helpers, canon, and existing admin
regressions. Model-response quality still needs a small live sample; mocked
provider tests verify the contract and protections, not every generated answer.
