// /api/orders.js
import fetch from "node-fetch";

const ML_API = "https://api.mercadolibre.com";

function mapShippingKind(o) {
  const mode = o?.shipping?.shipping_mode || o?.shipping?.mode || "";
  const tags = o?.tags || [];
  if (mode === "me1") return "ME1";
  if (mode === "custom" || tags.includes("to_be_agreed")) return "ACORDAR";
  return mode?.toUpperCase() || "OTRO";
}

async function getSellerId(token, fallbackEnvId) {
  // 1) /users/me con el token
  try {
    const r = await fetch(`${ML_API}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    if (r.ok && (j.id || j.user_id)) return String(j.id || j.user_id);
  } catch {}
  // 2) fallback a env si está seteado
  if (fallbackEnvId) return String(fallbackEnvId);
  throw new Error("No se pudo determinar el seller_id (users/me)");
}

function normalize(results = []) {
  return results.map((o) => {
    const it = o.order_items?.[0] || {};
    const item = it.item || {};
    return {
      id: o.id,
      date_created: o.date_created,
      status: o.status,
      total_amount: o.total_amount,
      buyer:
        o.buyer?.nickname ||
        `${o.buyer?.first_name || ""} ${o.buyer?.last_name || ""}`.trim(),
      shipping_mode: o.shipping?.shipping_mode || o.shipping?.mode || "",
      shipping_status: o.shipping?.status || "",
      shipping_id: o.shipping?.id || null,
      kind: mapShippingKind(o),
      title: item.title || "",
      sku: item.seller_sku || item.sku || "",
      quantity: it.quantity || 1,
    };
  });
}

export default async function handler(req, res) {
  try {
    const token = process.env.ML_ACCESS_TOKEN;
    if (!token) return res.status(400).json({ error: "Falta ML_ACCESS_TOKEN" });

    const urlReq = new URL(req.url, `http://${req.headers.host}`);
    const debug = urlReq.searchParams.get("debug") === "1";

    // 1) seller_id real desde el token
    const sellerId = await getSellerId(token, process.env.ML_SELLER_ID);

    // 2) primer intento: /orders/search/recent (rápido)
    const recentUrl = `${ML_API}/orders/search/recent?seller=${sellerId}&limit=50`;
    const r1 = await fetch(recentUrl, { headers: { Authorization: `Bearer ${token}` } });
    const j1 = await r1.json();

    // 3) si vacío, fallback a /orders/search normal (más amplio)
    let results = Array.isArray(j1.results) ? j1.results : [];
    let which = "recent";
    if (!results.length) {
      const normalUrl = `${ML_API}/orders/search?seller=${sellerId}&sort=date_desc&limit=50`;
      const r2 = await fetch(normalUrl, { headers: { Authorization: `Bearer ${token}` } });
      const j2 = await r2.json();
      if (!r2.ok) return res.status(r2.status).json(j2);
      results = Array.isArray(j2.results) ? j2.results : [];
      which = "search";
      if (debug) {
        return res.json({ which, raw: j2 }); // ver respuesta cruda
      }
    } else {
      if (!r1.ok) return res.status(r1.status).json(j1);
      if (debug) {
        return res.json({ which, raw: j1 }); // ver respuesta cruda
      }
    }

    // 4) normalizar
    const out = normalize(results);

    // 5) (opcional) filtrar en el front por ME1 o ACORDAR
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error inesperado", details: err.message });
  }
}
