import { NextResponse } from "next/server";
import { exchangeCodeForToken } from "../../../lib/meli";

export const runtime = "nodejs";

export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Falta code" }, { status: 400 });

  try {
    const tokens = await exchangeCodeForToken(code);

    const res = NextResponse.redirect(new URL("/", req.url));
    const base = { path: "/", secure: true, sameSite: "lax" };

    res.cookies.set("meli_access_token", tokens.access_token, { ...base, httpOnly: true });
    res.cookies.set("meli_user_id", String(tokens.user_id || ""), { ...base, httpOnly: false });

    return res;
  } catch (e) {
    return NextResponse.json({ error: "token_exchange_failed", detail: String(e) }, { status: 500 });
    // si querés debug más visible: return NextResponse.redirect(new URL("/debug", req.url));
  }
}
