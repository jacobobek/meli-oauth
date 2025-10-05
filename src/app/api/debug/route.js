import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET(req) {
  const jar = cookies();
  const data = {
    has_access_token: !!jar.get("meli_access_token"),
    user_id: jar.get("meli_user_id")?.value || null
  };

  const { searchParams } = new URL(req.url);
  if (searchParams.get("format") === "txt") {
    const body = `has_access_token=${data.has_access_token}\nuser_id=${data.user_id}`;
    return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  return NextResponse.json(data);
}
