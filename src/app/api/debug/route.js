import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET() {
  const jar = cookies();
  return NextResponse.json({
    has_access_token: !!jar.get("meli_access_token"),
    user_id: jar.get("meli_user_id")?.value || null
  });
}
