// /api/meli-summary.js
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ML_CLIENT_ID = process.env.ML_CLIENT_ID;
const ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- Helpers --------------------------------------------------------

async function mlFetch(accessToken, path, qs = "") {
  const url = `https://api.mercadolibre.com${path}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // Devuelve { ok:false, error } si falla para que no rompa todo
  if (!res.ok) {
    const err = await safeJson(res);
    return { ok: false, status: res.status, error: err || {} };
  }
  const data = await res.json();
  return { ok: true, data };
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// intenta refrescar el token y persistirlo
async function ensureValidToken(row) {
  // si querés, podés guardar expires_at y compararlo; por simplicidad, reintentamos
  // con el token actual y si 401, refrescamos
  return row; // el refresh real se hace on-demand abajo si hace falta
}

async function refreshToken(row) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: ML_CLIENT_ID,
    client_secret: ML_CLIENT_SECRET,
    refresh_token: row.refresh_token,
  }).toString();

  const res = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Refresh error ${res.status}: ${JSON.stringify(json)}`);
  }

  const {
    access_token,
    refresh_token,
    expires_in,
    scope,
    user_id: tokenUserId,
  } = json;

  // upsert
  const { error } = await supabase
    .from("meli_tokens")
    .upsert(
      {
        user_id: String(row.user_id || tokenUserId),
        access_token,
        refresh_token,
        expires_in,
        scope,
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    throw new Error(`Supabase upsert error: ${error.message}`);
  }

  return {
    ...row,
    access_token,
    refresh_token,
    expires_in,
    scope,
  };
}

function mapOrder(order, userId) {
  return {
    type: "Orden",
    id: order?.id ?? "",
    status: order?.status ?? "",
    amount: order?.total_amount ?? null,
    buyer:
      order?.buyer?.nickname ||
      order?.buyer?.first_name ||
      order?.buyer?.id ||
      "",
    date: order?.date_created || order?.last_updated || "",
    rawTopic: "orders",
    user_id: userId,
  };
}

function mapShipment(shipment, userId, order) {
  return {
    type: "Envío",
    id: shipment?.id ?? "",
    status: shipment?.status || shipment?.substatus || "",
    amount: null,
    buyer:
      order?.buyer?.nickname ||
      order?.buyer?.first_name ||
      order?.buyer?.id ||
      "",
    date: shipment?.date_created || shipment?.last_updated || "",
    rawTopic: "shipments",
    user_id: userId,
  };
}

// --- Handler --------------------------------------------------------

export default async function handler(req, res) {
  try {
    // 1) leer todos los usuarios con tokens
    const { data: rows, error } = await supabase
      .from("meli_tokens")
      .select("*");

    if (error) throw new Error(error.message);

    if (!rows || rows.length === 0) {
      return res.status(200).json({ events: [] });
    }

    // 2) por cada user_id traer órdenes + envíos
    let events = [];

    // limitar concurrencia (para no quemar rate limit brutalmente)
    // procesamos en serie por simplicidad
    for (let row of rows) {
      const userId = String(row.user_id);

      // asegurar token (el refresh se hace on-demand si hace falta)
      row = await ensureValidToken(row);

      // 2.1) buscar últimas 50 órdenes
      // si 401 -> refrescar token y reintentar una vez
      let ordersResp = await mlFetch(
        row.access_token,
        "/orders/search",
        `seller=${userId}&sort=date_desc&limit=50`
      );

      if (!ordersResp.ok && ordersResp.status === 401) {
        row = await refreshToken(row);
        ordersResp = await mlFetch(
          row.access_token,
          "/orders/search",
          `seller=${userId}&sort=date_desc&limit=50`
        );
      }

      if (!ordersResp.ok) {
        // si falló, registramos un “Evento” de error y seguimos con el siguiente user
        events.push({
          type: "Evento",
          id: "",
          status: `Error ${ordersResp.status}`,
          amount: null,
          buyer: "",
          date: new Date().toISOString(),
          rawTopic: `orders_search_error`,
          user_id: userId,
        });
        continue;
      }

      const orders = ordersResp.data?.results || [];

      // 2.2) por cada orden agregamos fila "Orden" + (si corresponde) fila "Envío"
      for (const order of orders) {
        // fila de orden
        events.push(mapOrder(order, userId));

        const shippingId =
          order?.shipping?.id ||
          order?.shipping?.receiver_address?.id ||
          order?.shipping_id;

        if (shippingId) {
          // pedir detalle de envío
          let shipResp = await mlFetch(
            row.access_token,
            `/shipments/${shippingId}`
          );
          if (!shipResp.ok && shipResp.status === 401) {
            row = await refreshToken(row);
            shipResp = await mlFetch(
              row.access_token,
              `/shipments/${shippingId}`
            );
          }

          if (shipResp.ok) {
            events.push(mapShipment(shipResp.data, userId, order));
          } else {
            // si falla el envío, no frenamos
            events.push({
              type: "Evento",
              id: String(shippingId),
              status: `ship_error_${shipResp.status}`,
              amount: null,
              buyer:
                order?.buyer?.nickname ||
                order?.buyer?.first_name ||
                order?.buyer?.id ||
                "",
              date: order?.date_created || new Date().toISOString(),
              rawTopic: "shipments_error",
              user_id: userId,
            });
          }
        }
      }
    }

    // 3) ordenar por fecha desc (si la hay)
    events.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });

    return res.status(200).json({ events });
  } catch (err) {
    console.error("meli-summary error:", err);
    return res
      .status(500)
      .json({ error: "Internal error", details: String(err?.message || err) });
  }
}
