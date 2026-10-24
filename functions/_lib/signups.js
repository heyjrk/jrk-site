const PAGES = new Set(["/", "/bonus/"]);

export function normalizeEmail(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

export function isEmail(value) {
  const email = normalizeEmail(value);
  if (email.length < 3 || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function safeReturnPath(raw) {
  if (typeof raw !== "string") return "/bonus/";
  let path = raw.split("#")[0].split("?")[0].trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return "/bonus/";
  }
  if (path.length > 1 && !path.endsWith("/")) path += "/";
  return PAGES.has(path) ? path : "/bonus/";
}

export function originAllowed(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export function tokensMatch(given, expected) {
  if (typeof given !== "string" || typeof expected !== "string") return false;
  const enc = new TextEncoder();
  const a = enc.encode(given);
  const b = enc.encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function csvEscape(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export async function signupsToCsv(kv) {
  const lines = ["email,created,page"];
  let cursor;
  do {
    const listed = await kv.list(cursor ? { cursor, limit: 1000 } : { limit: 1000 });
    for (const key of listed.keys) {
      const raw = await kv.get(key.name);
      let row = { email: key.name, created: "", page: "" };
      if (raw) {
        try {
          row = { ...row, ...JSON.parse(raw) };
        } catch {
          row.email = key.name;
        }
      }
      lines.push(
        [csvEscape(row.email), csvEscape(row.created), csvEscape(row.page)].join(","),
      );
    }
    cursor = listed.list_complete ? undefined : listed.cursor;
  } while (cursor);
  return `${lines.join("\n")}\n`;
}
