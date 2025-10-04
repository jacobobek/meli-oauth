// /api/meli/mark-shipped.js
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

export default async (req, res) => {
  try {
    const { shipment_id, order_id } = req.query;
    if (!shipment_id && !order_id) {
      return res.status(400).json({ error: "Falta shipment_id o order_id" });
    }

    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: row } = await supa
      .from("meli_tokens")
      .select("*")
      .limit(1)
      .single();
    const access_token = row?.access_token;
    if (!access_token) return res.status(401).json({ error: "Falta token" });

    // Intento oficial (puede no estar disponible para tu cuenta):
    if (shipment_id) {
      try {
        const r = await fetch(
          `https://api.mercadolibre.com/shipments/${encodeURIComponent(shipment_id)}/update`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${access_token}`,
            },
            body: JSON.stringify({ status: "shipped" }),
          }
        );

        if (r.ok) {
          const js = await r.json().catch(() => ({}));
          return res.json({ ok: true, via: "shipment.update", result: js });
        }

        // si falla, seguimos al plan B (nota en orden)
      } catch (err) {
        // continuamos al plan B
      }
    }

    // Plan B: agregamos nota en la orden (auditoría interna)
    if (order_id) {
      const note = {
        note: `Despachado manualmente desde el panel (${new Date().toISOString()}).`,
      };
      const r2 = await fetch(
        `https://api.mercadolibre.com/orders/${encodeURIComponent(order_id)}/notes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${access_token}`,
          },
          body: JSON.stringify(note),
        }
      );
      if (r2.ok) {
        const js = await r2.json().catch(() => ({}));
        return res.json({ ok: true, via: "order.note", result: js });
      }
      const txt = await r2.text();
      return res.status(r2.status).json({ error: "No se pudo marcar", details: txt });
    }

    return res.status(400).json({ error: "No se pudo marcar enviado" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};
