# Email templates

Greedy Pirate-themed HTML for the Supabase Auth transactional emails.

## Files

| File                 | Trigger                                                       |
| -------------------- | ------------------------------------------------------------- |
| `confirmation.html`  | First-time signup confirm (signup with email + password).     |
| `email_change.html`  | Anon → email upgrade and the change-email flow on `/profile`. |
| `recovery.html`      | Password reset (Forgot password? link in the auth modal).     |
| `magic_link.html`    | Passwordless sign-in (not currently wired into the UI).       |

The bindings live in `supabase/config.toml` under `[auth.email.template.*]`.

## Template variables

Supabase substitutes these at send time:

- `{{ .ConfirmationURL }}` — the action link (always include this as the CTA).
- `{{ .Email }}` — the user's current email.
- `{{ .NewEmail }}` — the pending new email (only meaningful in `email_change`).
- `{{ .SiteURL }}` — the configured site URL.
- `{{ .Token }}`, `{{ .TokenHash }}`, `{{ .RedirectTo }}` — rarely needed for HTML emails.

## Deploying changes to the cloud projects

Migrations auto-apply on Vercel build, but **auth config (templates + SMTP) does not**. Push it explicitly with the Supabase CLI:

```bash
export SUPABASE_ACCESS_TOKEN=...  # personal access token from app.supabase.com/account/tokens

# Production
supabase link --project-ref fyuasgpjrphxrituofsm
supabase config push

# Preview
supabase link --project-ref iosokzbammerxzyfuboc
supabase config push
```

Re-run after any change to the templates or to the `[auth.email.*]` blocks in `config.toml`.

## Local testing

`supabase start` serves these templates via the local Auth server. Trigger an email (signup, password reset, etc.) and inspect it at <http://127.0.0.1:54324> (Inbucket).
