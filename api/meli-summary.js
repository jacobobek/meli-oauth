// /api/meli-summary.js
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const ML_API = "https://api.mercadolibre.com";

function extractIdFromResource(resource) {
  if (!resource) return null;
  // ej: /orders/123456789 -> 123456789
  const match = resource.match(/\/(\d+)(\?.*)?$/);
  return match ? match[1] : null;
}

async function enrichOrder(id, token) {
  const r = await fetch(`${ML_API}/orders/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`order ${id} fetch failed`);
  const j = await r.json();
  return {
    type: "Orden",
    id: String(j.id),
    status: j.status,
    amount: j.total_amount,
    buyer: j?.buyer?.nickname || j?.buyer?.first_name || "",
    date: j.date_created,
  };
}

async function enrichShipment(id, token) {
  const r = await fetch(`${ML_API}/shipments/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`shipment ${id} fetch failed`);
  const j = await r.json();
  return {
    type: "Envío",
    id: String(j.id),
    status: j.status,
    amount: j?.shipping_option?.cost || null,
    buyer: j?.receiver_address?.receiver_name || "",
    date: j.date_created || j.last_updated,
  };
}

async function enrichQuestion(id, token) {
  const r = await fetch(`${ML_API}/questions/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`question ${id} fetch failed`);
  const j = await r.json();
  return {
    type: "Pregunta",
    id: String(j.id),
    status: j.status || "",
    amount: null,
    buyer: j?.from?.nickname || "",
    date: j?.date_created || j?.hold?.date_created || null,
  };
}

export default async function handler(req, res) {
  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Traer últimos webhooks
    const { data: hooks, error } = await supabase
      .from("meli_webhooks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });

    // 2) Mapear por cada hook -> resumen
    const results = [];
    for (const h of hooks) {
      const { topic, user_id, resource, created_at } = h;
      const objectId = extractIdFromResource(resource);

      // buscar token por user_id
      let token = null;
      if (user_id) {
        const { data: tk } = await supabase
          .from("meli_tokens")
          .select("access_token")
          .eq("user_id", String(user_id))
          .maybeSingle();
        token = tk?.access_token || null;
      }

      // fallback por si no tengo id o token
      const base = {
        type: "Evento",
        id: objectId || "",
        user_id: user_id || "",
        status: "",
        amount: null,
        buyer: "",
        date: created_at,
        rawTopic: topic || "",
      };

      if (!objectId || !token) {
        results.push(base);
        continue;
      }

      // Enriquecer según topic
      try {
        if (topic === "orders_v2") {
          results.push({ ...base, ...(await enrichOrder(objectId, token)) });
        } else if (topic === "shipments") {
          results.push({ ...base, ...(await enrichShipment(objectId, token)) });
        } else if (topic === "questions") {
          results.push({ ...base, ...(await enrichQuestion(objectId, token)) });
        } else {
          // topics no manejados: devolvemos base
          results.push(base);
        }
      } catch (e) {
        // cualquier error de enriquecimiento -> devolvemos base
        results.push(base);
      }
    }

    return res.status(200).json({ ok: true, events: results });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
