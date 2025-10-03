// /api/meli-summary.js
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const {
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    } = process.env;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Faltan SUPABASE_URL o SERVICE_ROLE" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Permite forzar un user_id por query (?user_id=xxxxx)
    const url = new URL(req.url, `http://${req.headers.host}`);
    const qUserId = url.searchParams.get("user_id");
    const debug = url.searchParams.get("debug");

    // 1) Tomamos el token más reciente de la tabla meli_tokens
    //    (si hay más de un usuario, filtramos por query user_id si viene)
    let query = supabase.from("meli_tokens").select("user_id, access_token").order("created_at", { ascending: false }).limit(1);

    if (qUserId) {
      query = supabase.from("meli_tokens").select("user_id, access_token").eq("user_id", qUserId).order("created_at", { ascending: false }).limit(1);
    }

    const { data: tokens, error: tokErr } = await query;
    if (tokErr) {
      return res.status(500).json({ error: "Error leyendo meli_tokens", details: tokErr.message });
    }
    if (!tokens || tokens.length === 0) {
      return res.status(200).json({ rows: [] });
    }

    const { user_id, access_token } = tokens[0];

    // 2) Llamamos a la API de Mercado Libre: últimas 50 órdenes del seller
    const meliUrl = new URL("https://api.mercadolibre.com/orders/search");
    meliUrl.searchParams.set("seller", qUserId || user_id);
    meliUrl.searchParams.set("sort", "date_desc");
    meliUrl.searchParams.set("limit", "50");

    const ordersResp = await fetch(meliUrl.toString(), {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const ordersJson = await ordersResp.json();

    if (!ordersResp.ok) {
      // Si falta scope de órdenes, suele dar 403 o 401
      if (debug) {
        return res.status(ordersResp.status).json({ error: "Error Meli", status: ordersResp.status, details: ordersJson });
      }
      return res.status(200).json({ rows: [], note: "No se pudieron leer las órdenes (¿falta scope?)" });
    }

    const results = Array.isArray(ordersJson.results) ? ordersJson.results : [];

    // 3) Mapeamos a las columnas que usa el dashboard
    const rows = results.map((o) => ({
      type: "order",
      id: o.id,
      status: o.order_status || o.status || "",
      amount: (o.total_amount != null ? o.total_amount : (o.payments?.[0]?.total_paid_amount ?? null)),
      buyer: o.buyer?.nickname || o.buyer?.first_name || "",
      date: o.date_created || o.stop_time || "",
      topic: "orders",
      user: qUserId || user_id,
    }));

    return res.status(200).json({ rows });
  } catch (err) {
    return res.status(500).json({ error: "Error inesperado", details: err?.message });
  }
}
