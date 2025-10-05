import { NextResponse } from "next/server";
export const runtime = "nodejs";

export async function GET() {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: process.env.MELI_CLIENT_ID,
    redirect_uri: process.env.MELI_REDIRECT_URI,
    state: "zeat_oauth"
  });
  return NextResponse.redirect(`https://auth.mercadolibre.com.ar/authorization?${p.toString()}`);
}
