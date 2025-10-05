import { NextResponse } from "next/server";
import { exchangeCodeForToken } from "../../../lib/meli.js";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Falta code" }, { status: 400 });

  const tokens = await exchangeCodeForToken(code).catch(e => {
    return null;
  });
  if (!tokens) return NextResponse.json({ error: "No se pudo obtener token" }, { status: 500 });

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set("meli_access_token", tokens.access_token, { httpOnly: true, secure: true, path: "/" });
  res.cookies.set("meli_user_id", String(tokens.user_id), { httpOnly: false, secure: true, path: "/" });
  return res;
}