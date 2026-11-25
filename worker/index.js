import assets from "./assets.js";

const sessionLifetime = 8 * 60 * 60;
const encoder = new TextEncoder();

async function signature(value, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

function equal(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

function loginPage(message = "", status = 200) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Admin sign in | Swaminarayan Medical College</title><style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:1rem;background:#f0f5f5;color:#143539;font:1rem system-ui,sans-serif}
  main{width:min(100%,26rem);padding:2rem;background:white;border:1px solid #d0e2e0;border-top:4px solid #087168;border-radius:1rem}h1{margin:.35rem 0 1.5rem;font-size:1.75rem}p{margin:0;color:#406068}
  label{display:block;margin-top:1rem;font-weight:650}input,button{width:100%;margin-top:.35rem;padding:.7rem;border-radius:.45rem;font:inherit}input{border:1px solid #779a99}button{margin-top:1.25rem;border:0;background:#08675f;color:white;font-weight:700;cursor:pointer}.error{margin-bottom:1rem;color:#9d2424}
  </style></head><body><main><p>Swaminarayan Medical College</p><h1>Admin sign in</h1>
  ${message ? `<p class="error" role="alert">${message}</p>` : ""}
  <form action="/admin/login" method="post"><label>Username<input name="username" autocomplete="username" required autofocus></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button type="submit">Sign in</button></form></main></body></html>`, {
    status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'" },
  });
}

async function handleAdmin(request, url, env) {
  if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) return loginPage("Admin sign-in is temporarily unavailable.", 503);
  if (url.pathname === "/admin/login") {
    if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
    if (request.headers.get("Origin") !== url.origin) return new Response(null, { status: 403 });
    if (!request.headers.get("Content-Type")?.startsWith("application/x-www-form-urlencoded")) return new Response(null, { status: 415 });
    const form = await request.formData();
    const username = form.get("username");
    const password = form.get("password");
    if (typeof password !== "string" || password.length > 256 || username !== "admin" ||
      !equal(await signature(password, env.ADMIN_SESSION_SECRET), await signature(env.ADMIN_PASSWORD, env.ADMIN_SESSION_SECRET))) {
      return loginPage("Incorrect username or password.", 401);
    }
    const expiry = String(Math.floor(Date.now() / 1000) + sessionLifetime);
    const nonce = crypto.randomUUID();
    const session = expiry + "." + nonce;
    const proof = await signature(session, env.ADMIN_SESSION_SECRET);
    return new Response(null, { status: 303, headers: {
      Location: "/admin/", "Cache-Control": "no-store",
      "Set-Cookie": `__Host-admin-session=${session}.${proof}; Path=/; Max-Age=${sessionLifetime}; HttpOnly; Secure; SameSite=Lax`,
    } });
  }

  if (url.pathname === "/admin/logout" && request.method === "POST" && request.headers.get("Origin") === url.origin) {
    return new Response(null, { status: 303, headers: {
      Location: "/admin/", "Cache-Control": "no-store",
      "Set-Cookie": "__Host-admin-session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
    } });
  }

  const cookie = request.headers.get("Cookie")?.match(/(?:^|;\s*)__Host-admin-session=(\d+)\.([a-f\d-]+)\.([a-f\d]{64})(?:;|$)/);
  if (!cookie || Number(cookie[1]) <= Date.now() / 1000 ||
    !equal(cookie[3], await signature(cookie[1] + "." + cookie[2], env.ADMIN_SESSION_SECRET))) return loginPage();
  return serveAsset("/admin/index.html", request.method, true);
}

function serveAsset(path, method, privatePage = false) {
  if (method !== "GET" && method !== "HEAD") return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  const asset = assets[path];
  if (!Object.hasOwn(assets, path)) return new Response("Page not found", { status: 404 });
  const [type, encoded] = asset;
  return new Response(method === "HEAD" ? null : Uint8Array.from(atob(encoded), value => value.charCodeAt(0)), {
    headers: {
      "Content-Type": type,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": privatePage ? "no-store" : path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
    },
  });
}

const contentBase = "https://raw.githubusercontent.com/meetparmar4100/ADMIN-MAHISAGAR-COLLAGE-WEBSITE/main/public";
const mediaTypes = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  webp: "image/webp", gif: "image/gif", avif: "image/avif",
};

async function serveCmsContent(path, method, contentType) {
  if (method !== "GET" && method !== "HEAD") return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  try {
    const upstream = await fetch(contentBase + path, { method, redirect: "error" });
    if (upstream.ok) {
      return new Response(upstream.body, { headers: {
        "Content-Type": contentType, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
      } });
    }
    if (upstream.status === 404 && path !== "/cms-data.json") return new Response("File not found", { status: 404 });
  } catch {
    if (path !== "/cms-data.json") return new Response("File temporarily unavailable", { status: 502 });
  }
  return serveAsset(path, method);
}

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    if (pathname === "/admin.html" || pathname === "/admin" || pathname.startsWith("/admin/") || url.searchParams.get("admin") === "1") {
      return handleAdmin(request, url, env);
    }
    if (pathname === "/cms-data.json") return serveCmsContent(pathname, request.method, "application/json");
    const media = pathname.match(/^\/cms-uploads\/[a-zA-Z0-9._-]+\.(pdf|png|jpe?g|webp|gif|avif)$/i);
    if (media) return serveCmsContent(pathname, request.method, mediaTypes[media[1].toLowerCase()]);
    const path = Object.hasOwn(assets, pathname) ? pathname : pathname.replace(/\/?$/, "/index.html");
    return serveAsset(path, request.method);
  },
};
