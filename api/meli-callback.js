// /api/meli-callback.js
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const code = url.searchParams.get("code");
    if (!code) return res.status(400).send("Falta ?code");

    const {
      ML_CLIENT_ID, ML_CLIENT_SECRET, ML_REDIRECT_URI,
      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
      SESSION_COOKIE_NAME = "meli_uid"
    } = process.env;

    if (!ML_CLIENT_ID || !ML_CLIENT_SECRET || !ML_REDIRECT_URI) {
      return res.status(500).send("Faltan env vars de ML");
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).send("Faltan env vars de Supabase");
    }

    // 1) Token
    const tokenResp = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: ML_CLIENT_ID,
        client_secret: ML_CLIENT_SECRET,
        code,
        redirect_uri: ML_REDIRECT_URI
      })
    });
    const tokenJson = await tokenResp.json();
    if (!tokenResp.ok) {
      return res.status(400).json({ error: "No se pudo obtener token", details: tokenJson });
    }

    const { access_token, refresh_token, expires_in, scope, user_id: tokenUserId } = tokenJson;

    // 2) user_id por si no vino (suele venir)
    let user_id = tokenUserId;
    if (!user_id) {
      const me = await fetch("https://api.mercadolibre.com/users/me", {
        headers: { Authorization: `Bearer ${access_token}` }
      }).then(r => r.json());
      user_id = me?.id || me?.user_id;
    }
    if (!user_id) return res.status(400).send("No se pudo determinar user_id");

    // 3) Guardar en Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await supabase.from("meli_tokens").upsert({
      user_id: String(user_id),
      access_token, refresh_token, expires_in, scope,
      created_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    if (error) return res.status(500).json({ error: "No se pudo guardar tokens", details: error.message });

    // 4) Setear cookie de sesión
    const cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(String(user_id))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`;
    res.setHeader("Set-Cookie", cookie);

    // 5) Redirigir al panel
    res.writeHead(302, { Location: "/envios.html" });
    res.end();
  } catch (e) {
    res.status(500).json({ error: e?.message || "Error inesperado" });
  }
}
