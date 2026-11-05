# Contact form setup

The contact form posts to `/api/contact`. The Worker keeps provider credentials server-side, checks same-origin requests, applies a honeypot and rate limit, and validates a Turnstile token when configured.

Set these Cloudflare Worker secrets before expecting external mail delivery:

```text
wrangler secret put RESEND_API_KEY
wrangler secret put CONTACT_TO_EMAIL
wrangler secret put CONTACT_FROM_EMAIL
wrangler secret put TURNSTILE_SECRET_KEY
```

`RESEND_API_KEY` is preferred; `SENDGRID_API_KEY` is also supported. Set `VITE_TURNSTILE_SITE_KEY` in the build environment so the public widget can generate the token that the Worker verifies. Until both sides are configured, the admin dashboard marks the integration as pending and the direct email link remains available.
