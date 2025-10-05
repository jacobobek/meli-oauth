import { NextResponse } from "next/server";
import { exchangeCodeForToken } from "../../../lib/meli.js";

export const runtime = "nodejs";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Falta code" }, { status: 400 });

  const tokens = await exchangeCodeForToken(code).catch(() => null);
  if (!tokens) return NextResponse.json({ error: "No se pudo obtener token" }, { status: 500 });

  const res = NextResponse.redirect(new URL("/", req.url));
  const base = { path: "/", secure: true, sameSite: "lax" }; // importante para OAuth

  res.cookies.set("meli_access_token", tokens.access_token, { ...base, httpOnly: true });
  res.cookies.set("meli_user_id", String(tokens.user_id), { ...base, httpOnly: false });

  return res;
}
