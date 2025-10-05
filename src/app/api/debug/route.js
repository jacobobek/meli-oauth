import { cookies } from "next/headers";
export const runtime = "nodejs";
export async function GET(){
  const jar = cookies();
  const has = !!jar.get("meli_access_token");
  const uid = jar.get("meli_user_id")?.value || "null";
  return new Response(`has_access_token=${has}\nuser_id=${uid}`, { headers: { "Content-Type":"text/plain; charset=utf-8" }});
}
