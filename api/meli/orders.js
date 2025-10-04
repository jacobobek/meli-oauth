// /api/meli/orders.js
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

export default async (req, res) => {
  try {
    const { mode = "me1,custom", payment = "approved", limit = 50 } = req.query;

    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Traemos el token guardado
    const { data: row, error } = await supa
      .from("meli_tokens")
      .select("*")
      .limit(1)
      .single();
    if (error) throw error;
    const access_token = row?.access_token;
    const seller_id = row?.user_id;
    if (!access_token || !seller_id) {
      return res.status(401).json({ error: "Faltan credenciales de ML en DB" });
    }

    // 2) Consultamos órdenes pagas
    const url = new URL("https://api.mercadolibre.com/orders/search");
    url.searchParams.set("seller", seller_id);
    url.searchParams.set("order_status", "paid");
    url.searchParams.set("limit", String(limit));

    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!r.ok) {
      const txt = await r.text();
      return res.status(r.status).json({ error: "ML error", details: txt });
    }
    const json = await r.json();

    const modes = mode.split(",").map((s) => s.trim().toLowerCase());

    // Normalizamos resultados
    const list = (json.results || []).map((o) => {
      const first = o.order_items?.[0];
      const p = o.payments?.[0];
      return {
        order_id: o.id,
        date_created: o.date_created,
        buyer: o.buyer?.nickname || `${o.buyer?.first_name || ""} ${o.buyer?.last_name || ""}`.trim(),
        payment_status: p?.status || "pending",
        total_amount: o.total_amount,
        shipping_mode: (o.shipping?.shipping_mode || "custom").toLowerCase(), // 'me1' | 'custom' | 'me2' etc
        shipment_id: o.shipping?.id || null,
        full_address: o.shipping?.receiver_address
          ? `${o.shipping.receiver_address.address_line || ""} ${o.shipping.receiver_address.comment || ""}`.trim()
          : "",
        product_title: first?.item?.title || "",
      };
    })
    .filter((x) => modes.includes(x.shipping_mode))
    .filter((x) => (payment === "all" ? true : x.payment_status === payment));

    res.json({ ok: true, count: list.length, items: list });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};
