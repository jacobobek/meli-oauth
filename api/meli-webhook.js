// /api/meli-webhook.js
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Helper: trae tokens por user_id
async function getTokensByUserId(user_id) {
  const { data, error } = await supabase
    .from("meli_tokens")
    .select("access_token, refresh_token, expires_in, created_at")
    .eq("user_id", String(user_id))
    .single();

  if (error) throw new Error(`No se pudo leer tokens para ${user_id}: ${error.message}`);
  return data;
}

export default async function handler(req, res) {
  try {
    // Mercado Libre a veces hace verificación por GET → respondemos OK
    if (req.method === "GET") {
      return res.status(200).send("OK");
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método no permitido" });
    }

    const event = req.body || {};
    const user_id = event.user_id || event?.application_id;
    const topic = event.topic;
    const resource = event.resource;

    // Guardamos el evento crudo para trazabilidad
    await supabase.from("meli_webhook_events").insert({
      user_id: user_id ? String(user_id) : null,
      topic,
      resource,
      payload: event,
    });

    // Respondemos rápido para que ML no timeoutee
    res.status(200).json({ ok: true });

    // Si falta info, salimos
    if (!user_id || !topic || !resource) return;

    // Traemos access_token del vendedor
    const tokens = await getTokensByUserId(user_id);
    const access_token = tokens?.access_token;
    if (!access_token) return;

    if (topic === "orders_v2") {
      const detailUrl = `https://api.mercadolibre.com${resource}?access_token=${access_token}`;
      const orderResp = await fetch(detailUrl);
      const orderJson = await orderResp.json();
      if (!orderResp.ok) {
        console.error("Error detalle de orden:", orderJson);
        return;
      }

      const upsertData = {
        order_id: orderJson.id,
        user_id: String(user_id),
        status: orderJson.status || null,
        total_amount: orderJson.total_amount ?? null,
        buyer: orderJson.buyer ?? null,
        shipping: orderJson.shipping ?? null,
        raw: orderJson,
      };

      const { error: upsertErr } = await supabase
        .from("meli_orders")
        .upsert(upsertData, { onConflict: "order_id" });

      if (upsertErr) {
        console.error("No se pudo upsert meli_orders:", upsertErr.message);
      }
    }

    if (topic === "shipments") {
      const detailUrl = `https://api.mercadolibre.com${resource}?access_token=${access_token}`;
      const shipResp = await fetch(detailUrl);
      const shipJson = await shipResp.json();
      if (!shipResp.ok) {
        console.error("Error detalle de envío:", shipJson);
      }
    }

    if (topic === "payments") {
      const detailUrl = `https://api.mercadolibre.com${resource}?access_token=${access_token}`;
      const payResp = await fetch(detailUrl);
      const payJson = await payResp.json();
      if (!payResp.ok) {
        console.error("Error detalle de pago:", payJson);
      }
    }
  } catch (err) {
    console.error("Error en webhook:", err.message);
  }
}
