// /api/meli-refresh.js
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

/**
 * Cómo usar:
 * - GET /api/meli-refresh              -> recorre TODOS los registros de meli_tokens y renueva el que esté por vencer
 * - GET /api/meli-refresh?user_id=123  -> renueva SOLO ese user_id
 * - GET /api/meli-refresh?force=true   -> fuerza la renovación aunque no esté por vencer
 *
 * Requiere vars de entorno en Vercel:
 *  - ML_CLIENT_ID
 *  - ML_CLIENT_SECRET
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_ROLE_KEY
 */

export default async function handler(req, res) {
  try {
    // 1) Cargar envs
    const {
      ML_CLIENT_ID,
      ML_CLIENT_SECRET,
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    } = process.env;

    if (!ML_CLIENT_ID || !ML_CLIENT_SECRET) {
      return res
        .status(500)
        .json({ error: "Faltan ML_CLIENT_ID / ML_CLIENT_SECRET" });
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res
        .status(500)
        .json({ error: "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" });
    }

    // 2) Leer filtros desde query
    const url = new URL(req.url, `http://${req.headers.host}`);
    const filterUserId = url.searchParams.get("user_id");
    const force = url.searchParams.get("force") === "true";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 3) Traer tokens desde Supabase
    let query = supabase
      .from("meli_tokens")
      .select("user_id, access_token, refresh_token, expires_in, scope, created_at");

    if (filterUserId) query = query.eq("user_id", String(filterUserId));

    const { data: tokens, error: readError } = await query;

    if (readError) {
      return res
        .status(500)
        .json({ error: "Error leyendo meli_tokens", details: readError.message });
    }
    if (!tokens || tokens.length === 0) {
      return res.status(200).json({ ok: true, refreshed: [], message: "No hay tokens para renovar" });
    }

    const now = Date.now();
    const results = [];

    // 4) Para cada registro, decidir si renovar y hacerlo
    for (const row of tokens) {
      const { user_id, refresh_token, expires_in, created_at } = row;

      // Calcular si falta poco para expirar: expires_at = created_at + expires_in
      const createdMs = new Date(created_at).getTime();
      const expiresMs = createdMs + (Number(expires_in || 0) * 1000);

      // Renovamos si faltan menos de 10 minutos o si force=true
      const needsRefresh = force || (expiresMs - now) < (10 * 60 * 1000);

      if (!needsRefresh) {
        results.push({ user_id, refreshed: false, reason: "Aún no vence" });
        continue;
      }

      // 5) Llamar al endpoint de refresh de Mercado Libre
      try {
        const refreshResp = await fetch("https://api.mercadolibre.com/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: ML_CLIENT_ID,
            client_secret: ML_CLIENT_SECRET,
            refresh_token: refresh_token,
          }).toString(),
        });

        const refreshJson = await refreshResp.json();

        if (!refreshResp.ok) {
          results.push({ user_id, refreshed: false, error: refreshJson });
          continue;
        }

        const {
          access_token: newAccess,
          refresh_token: newRefresh,
          expires_in: newExpires,
          scope: newScope,
        } = refreshJson;

        // 6) Guardar en Supabase (UPSERT por user_id)
        const { error: upsertError } = await supabase
          .from("meli_tokens")
          .upsert({
            user_id: String(user_id),
            access_token: newAccess,
            refresh_token: newRefresh || refresh_token, // a veces ML no devuelve refresh nuevo
            expires_in: newExpires,
            scope: newScope,
            created_at: new Date().toISOString(), // fecha de este refresh
          }, { onConflict: "user_id" });

        if (upsertError) {
          results.push({ user_id, refreshed: false, error: upsertError.message });
          continue;
        }

        results.push({ user_id, refreshed: true });
      } catch (err) {
        results.push({ user_id, refreshed: false, error: err?.message });
      }
    }

    return res.status(200).json({ ok: true, refreshed: results });
  } catch (err) {
    return res.status(500).json({ error: "Error inesperado", details: err?.message });
  }
}
