// /api/meli-summary.js
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ML_CLIENT_ID,
  ML_CLIENT_SECRET,
} = process.env;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function mlFetch(accessToken, path, qs = "") {
  const url = `https://api.mercadolibre.com${path}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    return { ok: false, status: res.status, data: await safeJson(res), url };
  }
  return { ok: true, status: res.status, data: await res.json(), url };
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
  if (!res.ok) throw new Error(`Refresh ${res.status}: ${JSON.stringify(json)}`);

  const {
    access_token,
    refresh_token,
    expires_in,
    scope,
    user_id: tokenUserId,
  } = json;

  const user_id = String(row.user_id || tokenUserId);
  const { error } = await supabase
    .from("meli_tokens")
    .upsert(
      {
        user_id,
        access_token,
        refresh_token,
        expires_in,
        scope,
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  if (error) throw new Error(`Supabase upsert: ${error.message}`);

  return { ...row, access_token, refresh_token, expires_in, scope };
}

// Mappers
const mapOrder = (order, userId) => ({
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
});

const mapShipment = (shipment, userId, order) => ({
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
});

export default async function handler(req, res) {
  const debug = req.url.includes("debug=1");
  const diag = []; // info por usuario

  try {
    // 1) Tokens en Supabase
    const { data: rows, error } = await supabase
      .from("meli_tokens")
      .select("*");
    if (error) throw new Error(error.message);

    if (!rows || rows.length === 0) {
      if (debug) {
        return res.status(200).json({
          events: [],
          debug: [{ step: "no_tokens", msg: "Tabla meli_tokens vacía" }],
        });
      }
      return res.status(200).json({ events: [] });
    }

    let events = [];

    for (let row of rows) {
      const userId = String(row.user_id);
      const info = { user_id: userId, steps: [] };
      diag.push(info);

      // 2) Traer órdenes (últimas 50)
      let ordersResp = await mlFetch(
        row.access_token,
        "/orders/search",
        `seller=${userId}&sort=date_desc&limit=50`
      );
      info.steps.push({
        step: "orders/search",
        url: ordersResp.url,
        status: ordersResp.status,
        ok: ordersResp.ok,
        sample: ordersResp.ok
          ? { results_count: ordersResp.data?.results?.length ?? 0 }
          : { error: ordersResp.data },
      });

      // 2.a) Si 401 → refrescar token y reintentar
      if (!ordersResp.ok && ordersResp.status === 401) {
        try {
          row = await refreshToken(row);
          info.steps.push({ step: "refresh_token", ok: true });
          ordersResp = await mlFetch(
            row.access_token,
            "/orders/search",
            `seller=${userId}&sort=date_desc&limit=50`
          );
          info.steps.push({
            step: "orders/search_retry",
            status: ordersResp.status,
            ok: ordersResp.ok,
          });
        } catch (e) {
          info.steps.push({ step: "refresh_token", ok: false, error: e.message });
        }
      }

      if (!ordersResp.ok) {
        // log y continuar con el próximo usuario
        info.steps.push({
          step: "orders_failed",
          status: ordersResp.status,
          error: ordersResp.data,
        });
        continue;
      }

      const orders = ordersResp.data?.results || [];
      info.steps.push({ step: "orders_count", count: orders.length });

      // 3) Para cada orden, mapeo + envío si corresponde
      for (const order of orders) {
        events.push(mapOrder(order, userId));

        const shippingId =
          order?.shipping?.id ||
          order?.shipping?.receiver_address?.id ||
          order?.shipping_id;

        if (shippingId) {
          let shipResp = await mlFetch(
            row.access_token,
            `/shipments/${shippingId}`
          );
          info.steps.push({
            step: "shipments_get",
            shippingId,
            status: shipResp.status,
            ok: shipResp.ok,
          });
          if (!shipResp.ok && shipResp.status === 401) {
            // token recién refrescado arriba, pero igual reintento por las dudas
            try {
              row = await refreshToken(row);
              info.steps.push({ step: "refresh_token_for_ship", ok: true });
              shipResp = await mlFetch(
                row.access_token,
                `/shipments/${shippingId}`
              );
              info.steps.push({
                step: "shipments_retry",
                shippingId,
                status: shipResp.status,
                ok: shipResp.ok,
              });
            } catch (e) {
              info.steps.push({
                step: "refresh_token_for_ship",
                ok: false,
                error: e.message,
              });
            }
          }
          if (shipResp.ok) {
            events.push(mapShipment(shipResp.data, userId, order));
          } else {
            // No frena: deja constancia del error de shipment
            info.steps.push({
              step: "shipment_failed",
              shippingId,
              status: shipResp.status,
              error: shipResp.data,
            });
          }
        }
      }
    }

    // 4) Ordenar por fecha desc
    events.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });

    if (debug) {
      return res.status(200).json({
        events,
        count: events.length,
        debug: diag,
      });
    }
    return res.status(200).json({ events });
  } catch (err) {
    console.error("meli-summary error:", err);
    if (debug) {
      return res
        .status(500)
        .json({ error: String(err?.message || err), debug: diag });
    }
    return res.status(500).json({ error: "Internal error" });
  }
}
