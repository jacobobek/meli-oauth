export const runtime = "nodejs";

export async function GET() {
  const API = "https://api.mercadolibre.com";
  try {
    const { cookies } = await import("next/headers");
    const jar = cookies();
    const access = jar.get("meli_access_token")?.value || null;
    if (!access) return new Response(JSON.stringify({ error: "no_access_token" }), { status: 401 });

    const r = await fetch(`${API}/users/me`, {
      headers: { Authorization: `Bearer ${access}` }
    });
    const text = await r.text();
    return new Response(text, {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
}
