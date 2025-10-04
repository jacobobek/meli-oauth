// /api/label.js
import { createClient } from "@supabase/supabase-js";

function getUserId(req) {
  const { SESSION_COOKIE_NAME = "meli_uid" } = process.env;
  const m = (req.headers.cookie || "").match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}
async function getToken(user_id) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await supa.from("meli_tokens").select("*").eq("user_id", String(user_id)).single();
  return data?.access_token || null;
}

export default async function handler(req, res) {
  try {
    const user_id = getUserId(req);
    if (!user_id) return res.status(401).json({ error: "No session" });

    const token = await getToken(user_id);
    if (!token) return res.status(401).json({ error: "No token" });

    const { shipment_id } = req.query;
    if (!shipment_id) return res.status(400).json({ error: "shipment_id requerido" });

    const url = `https://api.mercadolibre.com/shipments/${shipment_id}/labels?response_type=pdf`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return res.status(r.status).send(await r.text());

    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="label_${shipment_id}.pdf"`);
    res.status(200).send(buf);
  } catch (e) {
    res.status(500).json({ error: e?.message || "Error label" });
  }
}
