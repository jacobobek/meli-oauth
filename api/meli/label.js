// /api/meli/label.js
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

export default async (req, res) => {
  try {
    const { id } = req.query; // shipment_id
    if (!id) return res.status(400).json({ error: "Falta shipment_id ?id=" });

    // token desde supabase
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: row } = await supa
      .from("meli_tokens")
      .select("*")
      .limit(1)
      .single();
    const access_token = row?.access_token;
    if (!access_token) return res.status(401).json({ error: "Falta token ML" });

    // endpoint oficial de ML para etiquetas:
    // GET /shipments/{id}/labels?response_type=pdf
    const url = `https://api.mercadolibre.com/shipments/${encodeURIComponent(
      id
    )}/labels?response_type=pdf`;

    const r = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });

    if (r.status === 404) {
      return res.status(404).json({
        error: "Sin etiqueta disponible (posible envío 'custom')",
      });
    }
    if (!r.ok) {
      const txt = await r.text();
      return res.status(r.status).json({ error: "ML error", details: txt });
    }

    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="label-${id}.pdf"`);
    res.end(buf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};
