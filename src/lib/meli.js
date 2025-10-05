import { cookies } from "next/headers";

const API = "https://api.mercadolibre.com";

export function getAccessTokenFromCookies() {
  try {
    const jar = cookies();
    return jar.get("meli_access_token")?.value || null;
  } catch {
    return null;
  }
}

export async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.MELI_CLIENT_ID,
    client_secret: process.env.MELI_CLIENT_SECRET,
    code,
    redirect_uri: process.env.MELI_REDIRECT_URI
  });

  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error("No se pudo intercambiar el código por token: " + t);
  }
  return res.json();
}

export async function meliGet(path, accessToken) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Error GET ${path}: ${t}`);
  }
  return res.json();
}
