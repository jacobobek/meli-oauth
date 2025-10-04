// /api/orders.js
import fetch from "node-fetch";

const ML_API = "https://api.mercadolibre.com";

function mapShippingKind(o) {
  const mode = o?.shipping?.shipping_mode || o?.shipping?.mode || "";
  const tags = o?.tags || [];
  // Heurística robusta:
  if (mode === "me1") return "ME1";
  if (mode === "custom" || tags.includes("to_be_agreed")) return "ACORDAR";
  // Otros: me2, not_specified, etc.
  return mode?.toUpperCase() || "OTRO";
}

export default async function handler(req, res) {
  try {
    const token = process.env.ML_ACCESS_TOKEN;
    if (!token) return res.status(400).json({ error: "Falta ML_ACCESS_TOKEN" });

    // Trae últimas 50
    const url = `${ML_API}/orders/search/recent?seller=${process.env.ML_SELLER_ID || ""}&limit=50`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    if (!r.ok) return res.status(r.status).json(j);

    const out = (j?.results || []).map(o => {
      const it = o.order_items?.[0] || {};
      const item = it.item || {};
      return {
        id: o.id,
        date_created: o.date_created,
        status: o.status,
        total_amount: o.total_amount,
        buyer: o.buyer?.nickname || `${o.buyer?.first_name || ""} ${o.buyer?.last_name || ""}`.trim(),
        shipping_mode: o.shipping?.shipping_mode || o.shipping?.mode || "",
        shipping_status: o.shipping?.status || "",
        shipping_id: o.shipping?.id || null,
        kind: mapShippingKind(o),
        title: item.title || "",
        sku: item.seller_sku || item.sku || "",
        quantity: it.quantity || 1
      };
    });

    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error inesperado", details: err.message });
  }
}
