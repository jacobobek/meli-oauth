// /api/orders.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    const only = (searchParams.get("only") || "").toLowerCase(); // me1|to_agree|""
    const token = process.env.ML_ACCESS_TOKEN;

    if (!token) {
      return res.status(200).json({ orders: [], note: "Set ML_ACCESS_TOKEN in Vercel" });
    }

    // Últimas 50 órdenes pagadas
    const url = "https://api.mercadolibre.com/orders/search/recent?seller=me&limit=50&order.status=paid";
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const json = await resp.json();

    if (!resp.ok) {
      return res.status(resp.status).json(json);
    }

    const orders = (json.results || [])
      .map(o => ({
        id: o.id,
        date_created: o.date_created,
        status: o.status,
        total_amount: o.total_amount,
        buyer: o.buyer?.nickname || o.buyer?.first_name || "",
        shipping_mode: o.shipping?.shipping_mode || o.shipping?.mode || "",
        shipping_status: o.shipping?.status || "",
        shipping_id: o.shipping?.id || null,
        title: o.order_items?.[0]?.item?.title || "",
        quantity: o.order_items?.[0]?.quantity || 1
      }))
      .filter(o => {
        if (only === "me1") return o.shipping_mode === "me1";
        if (only === "to_agree") return o.shipping_mode === "me2" || o.shipping_mode === "custom" || o.shipping_mode === "not_specified" || o.shipping_mode === "to_agree";
        return true;
      });

    res.status(200).json({ orders });
  } catch (err) {
    res.status(500).json({ error: "Unexpected error", details: err.message });
  }
}
