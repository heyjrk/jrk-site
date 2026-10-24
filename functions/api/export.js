import { signupsToCsv, tokensMatch } from "../_lib/signups.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const expected = env.EXPORT_TOKEN;
  if (!expected || !env.SIGNUPS) {
    return new Response("Not found.", { status: 404 });
  }

  const header = request.headers.get("Authorization") || "";
  const given = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!tokensMatch(given, expected)) {
    return new Response("Unauthorized.", {
      status: 401,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const csv = await signupsToCsv(env.SIGNUPS);
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="signups.csv"',
      "cache-control": "no-store",
    },
  });
}
