import { NextResponse } from "next/server";

export const runtime = "nodejs";

const API = "https://api.mercadolibre.com";

export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const debug = url.searchParams.get("debug") === "1";

  if (!code) {
    return NextResponse.json({ error: "Falta code" }, { status: 400 });
  }

  // Intercambio del code por el access_token (form-urlencoded)
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.MELI_CLIENT_ID ?? "",
    client_secret: process.env.MELI_CLIENT_SECRET ?? "",
    code,
    redirect_uri: process.env.MELI_REDIRECT_URI ?? "" // Debe coincidir EXACTO con el configurado en ML
  });

  let tokens;
  try {
    const r = await fetch(`${API}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });
    const text = await r.text();
    if (!r.ok) {
      // Devolvemos el motivo para depurar redirect_uri_mismatch, etc.
      return NextResponse.json(
        { error: "token_exchange_failed", status: r.status, body: text },
        { status: 500 }
      );
    }
    tokens = JSON.parse(text);
  } catch (e) {
    return NextResponse.json(
      { error: "fetch_failed", message: String(e) },
      { status: 500 }
    );
  }

  // Seteo de cookies y respuesta
  const res = debug
    ? NextResponse.json({
        ok: true,
        user_id: tokens?.user_id ?? null,
        expires_in: tokens?.expires_in ?? null
      })
    : NextResponse.redirect(new URL("/", req.url));

  const base = { path: "/", secure: true, sameSite: "lax" };
  // access_token (httpOnly)
  res.cookies.set("meli_access_token", tokens.access_token, {
    ...base,
    httpOnly: true,
    maxAge: tokens?.expires_in ? Number(tokens.expires_in) : undefined
  });
  // refresh_token (opcional, por si luego querés refrescar)
  if (tokens.refresh_token) {
    res.cookies.set("meli_refresh_token", tokens.refresh_token, {
      ...base,
      httpOnly: true
    });
  }
  // user_id (legible por el front)
  if (tokens.user_id) {
    res.cookies.set("meli_user_id", String(tokens.user_id), {
      ...base,
      httpOnly: false
    });
  }

  return res;
}
