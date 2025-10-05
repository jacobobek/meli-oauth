import { cookies } from "next/headers";
export const runtime = "nodejs";

export async function GET() {
  const access = cookies().get("meli_access_token")?.value;
  if (!access) return new Response("no_access_token", { status: 401 });
  const r = await fetch("https://api.mercadolibre.com/users/me", {
    headers: { Authorization: `Bearer ${access}` }
  });
  const txt = await r.text();
  return new Response(txt, { status: r.status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
