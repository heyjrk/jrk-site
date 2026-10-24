# Email list

The signup forms post to `/api/subscribe`. A honeypot field named `hp_field` is stored nowhere. A real address is written to the Cloudflare KV namespace bound as `SIGNUPS`. The key is the lowercased email, so the same address does not create a second row. The value is JSON: `email`, `created` (UTC), and `page` (which prototype they used).

This branch does not create the namespace and does not deploy.

## Bind it

1. In the Cloudflare dashboard, create a KV namespace (Workers & Pages → KV).
2. Open the Pages project `jrk-site` → Settings → Bindings → Add → KV namespace.
3. Variable name: `SIGNUPS`. Choose the namespace. Add it for Production and Preview.
4. Settings → Variables and secrets → add `EXPORT_TOKEN` (encrypt it). Use a long random string.
5. Redeploy the project so the binding is picked up. Bindings do not apply to a deploy that already finished.

Local preview, from a built `public/` directory:

```bash
printf 'EXPORT_TOKEN=local-dev\n' > .dev.vars
npx wrangler pages dev public --kv SIGNUPS
```

`.dev.vars` is gitignored. Do not commit the token.

## Export a CSV

```bash
curl -sS -H "Authorization: Bearer $EXPORT_TOKEN" \
  https://realjrk.com/api/export \
  -o signups.csv
```

The file has a header row: `email,created,page`. The route returns 401 without the token, and 404 if `EXPORT_TOKEN` or `SIGNUPS` is not set.

To pull the same rows without the route, list the namespace from a machine logged in with Wrangler. The namespace id is on the KV page in the dashboard.

```bash
npx wrangler kv key list --namespace-id="$SIGNUPS_NAMESPACE_ID" --remote
npx wrangler kv key get --namespace-id="$SIGNUPS_NAMESPACE_ID" "reader@example.com" --remote --text
```

The curl export is the one that returns a CSV in one step.
