import { NextResponse } from "next/server";
import { exchangeCodeForToken } from "../../../lib/meli.js";

export const runtime = "nodejs";

export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const debug = url.searchParams.get("debug") === "1";
  if (!code) {
    return NextResponse.json({ error: "Falta code", url: req.url }, { status: 400 });
  }

  let tokens = null;
  try {
    tokens = await exchangeCodeForToken(code);
  } catch (e) {
    if (debug) {
      return NextResponse.json({ error: "token_exchange_failed", message: String(e) }, { status: 500 });
    }
    return NextResponse.json({ error: "No se pudo obtener token" }, { status: 500 });
  }

  const res = debug
    ? NextResponse.json({
        got_code: true,
        token_ok: !!tokens?.access_token,
        user_id: tokens?.user_id ?? null,
        note: "debug=1 evita redirigir; quita el debug cuando funcione"
      })
    : NextResponse.redirect(new URL("/", req.url));

  const base = { path: "/", secure: true, sameSite: "lax" }; // importante para OAuth
  res.cookies.set("meli_access_token", tokens.access_token, { ...base, httpOnly: true });
  res.cookies.set("meli_user_id", String(tokens.user_id), { ...base, httpOnly: false });

  return res;
}
