// /api/envios.js
import { createClient } from "@supabase/supabase-js";

async function getUserIdFromCookie(req) {
  const { SESSION_COOKIE_NAME = "meli_uid" } = process.env;
  const cookie = req.headers.cookie || "";
  const m = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

async function getTokenForUser(user_id) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.from("meli_tokens").select("*").eq("user_id", String(user_id)).single();
  if (error || !data) return null;
  return data;
}

async function mlFetch(token, path, qs = "") {
  const url = `https://api.mercadolibre.com${path}${qs ? `?${qs}` : ""}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`ML ${r.status}: ${t}`);
  }
  return r.json();
}

export default async function handler(req, res) {
  try {
    const user_id = await getUserIdFromCookie(req);
    if (!user_id) return res.status(401).json({ error: "No hay sesión. Ir a /login.html" });

    const tokenRow = await getTokenForUser(user_id);
    if (!tokenRow?.access_token) return res.status(401).json({ error: "Token inexistente para este usuario" });

    // Orders del seller (últimas 50)
    const qs = new URLSearchParams({ seller: String(user_id), sort: "date_desc", limit: "50" }).toString();
    const data = await mlFetch(tokenRow.access_token, "/orders/search", qs);

    const out = [];
    for (const o of (data?.results || [])) {
      const ship = o?.shipping || {};
      const logistic = ship.logistic_type || ship.mode || "";
      if (!(logistic === "me1" || logistic === "custom")) continue;

      const pay = (o.payments || [])[0] || {};
      const payStatus = pay?.status || o?.order_status || "—";
      const it = (o.order_items && o.order_items[0]) || {};
      const title = it?.item?.title || it?.item?.seller_sku || "—";

      out.push({
        id: o.id,
        shipping_type: logistic === "me1" ? "me1" : "custom",
        shipment_id: ship?.id || null,
        payment_status: payStatus,
        buyer: o?.buyer?.nickname || o?.buyer?.first_name || "",
        item_title: title,
        date_created: o?.date_created
      });
    }

    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: e?.message || "Error envios" });
  }
}
