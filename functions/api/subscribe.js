import { isEmail, normalizeEmail, originAllowed, safeReturnPath } from "../_lib/signups.js";

function redirectJoined(request, path) {
  const dest = new URL(path, request.url);
  dest.searchParams.set("joined", "1");
  return Response.redirect(dest.toString(), 303);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!originAllowed(request)) {
    return new Response("That request was refused.", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return new Response("Send the form again.", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const path = safeReturnPath(form.get("page"));
  const trap = String(form.get("hp_field") || "").trim();
  if (trap) return redirectJoined(request, path);

  const email = normalizeEmail(form.get("email"));
  if (!isEmail(email)) {
    return new Response("Enter a valid email address.", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  if (!env.SIGNUPS) {
    return new Response("The list is not available yet.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const existing = await env.SIGNUPS.get(email);
  if (!existing) {
    await env.SIGNUPS.put(
      email,
      JSON.stringify({
        email,
        created: new Date().toISOString(),
        page: path,
      }),
    );
  }

  return redirectJoined(request, path);
}
