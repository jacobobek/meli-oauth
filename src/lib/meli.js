const API = "https://api.mercadolibre.com";

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

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function meliGet(path, accessToken) {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` }});
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
