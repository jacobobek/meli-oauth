import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.MELI_CLIENT_ID,
    redirect_uri: process.env.MELI_REDIRECT_URI,
    // opcional: un state para debugging
    state: "zeat_debug"
  });
  return NextResponse.redirect(`https://auth.mercadolibre.com.ar/authorization?${params.toString()}`);
}
