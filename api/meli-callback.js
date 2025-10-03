// /api/meli-callback.js
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    // 1) Leer "code" (Mercado Libre redirige a /api/meli-callback?code=XXXX)
    const url = new URL(req.url, `http://${req.headers.host}`);
    const code = url.searchParams.get("code");
    if (!code) {
      return res.status(400).json({ error: "Falta code en la URL" });
    }

    // 2) Variables de entorno (configurarlas en Vercel)
    const {
      ML_CLIENT_ID,
      ML_CLIENT_SECRET,
      ML_REDIRECT_URI,
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    } = process.env;

    if (!ML_CLIENT_ID || !ML_CLIENT_SECRET || !ML_REDIRECT_URI) {
      return res
        .status(500)
        .json({ error: "Faltan variables de entorno de Mercado Libre" });
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res
        .status(500)
        .json({ error: "Faltan variables de entorno de Supabase" });
    }

    // 3) Intercambiar code por tokens en Mercado Libre
    const tokenResp = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: ML_CLIENT_ID,
        client_secret: ML_CLIENT_SECRET,
        code,
        redirect_uri: ML_REDIRECT_URI,
      }).toString(),
    });

    const tokenJson = await tokenResp.json();

    if (!tokenResp.ok) {
      return res.status(400).json({
        error: "No se pudo obtener el token",
        details: tokenJson,
      });
    }

    const {
      access_token,
      refresh_token,
      expires_in,
      scope,
      user_id: tokenUserId,
    } = tokenJson;

    // 4) Obtener user_id si no vino en la respuesta de token (por las dudas)
    let user_id = tokenUserId;
    if (!user_id) {
      const meResp = await fetch("https://api.mercadolibre.com/users/me", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const meJson = await meResp.json();
      user_id = meJson?.id || meJson?.user_id;
    }

    if (!user_id) {
      return res
        .status(400)
        .json({ error: "No se pudo determinar el user_id de Mercado Libre" });
    }

    // 5) Guardar/actualizar en Supabase (tabla: meli_tokens)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error } = await supabase
      .from("meli_tokens")
      .upsert(
        {
          user_id: String(user_id),
          access_token,
          refresh_token,
          expires_in,
          scope,
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id" } // si user_id es PK o tiene unique, esto hace UPSERT
      );

    if (error) {
      return res.status(500).json({
        error: "No se pudo guardar en Supabase",
        details: error.message,
      });
    }

    // 6) Responder al navegador
    res
      .status(200)
      .send(
        `¡Autorización OK! user_id=${user_id}. Tokens guardados/actualizados en DB.`
      );
  } catch (err) {
    res.status(500).json({ error: "Error inesperado", details: err?.message });
  }
}
