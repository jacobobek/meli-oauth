// /api/mark-shipped.js
import fetch from "node-fetch";

const ML_API = "https://api.mercadolibre.com";

export default async function handler(req, res) {
  try {
    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    const shippingId = searchParams.get("shipping_id");
    const token = process.env.ML_ACCESS_TOKEN;

    if (!token) return res.status(400).json({ error: "Falta ML_ACCESS_TOKEN" });
    if (!shippingId) return res.status(400).json({ error: "Falta shipping_id" });

    // Intento genérico (puede variar por país/cuenta):
    const url = `${ML_API}/shipments/${shippingId}`;
    const payload = { status: "ready_to_ship" };

    const r = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const j = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({
        error: "No se pudo actualizar el estado",
        details: j
      });
    }

    res.json({ ok: true, result: j });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error inesperado", details: err.message });
  }
}
