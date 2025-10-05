import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isME1, isBuenosAires } from "../../../lib/filters.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API = "https://api.mercadolibre.com";

export async function GET(req) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";

  const jar = cookies();
  const access = jar.get("meli_access_token")?.value || null;
  if (!access) {
    return NextResponse.json({ error: "No autenticado (sin cookie access_token)" }, { status: 401 });
  }

  // 1) ORDERS SEARCH
  const searchUrl = `${API}/orders/search?seller=me&order.status=paid&sort=date_desc&limit=50`;
  const oRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${access}` }
  });

  const oText = await oRes.text();
  if (!oRes.ok) {
    // No rompas el servidor: devolvé info de diagnóstico
    return NextResponse.json({
      step: "orders_search",
      status: oRes.status,
      searchUrl,
      body: safeParse(oText)
    }, { status: 200 }); // 200 para que puedas ver el payload en el browser
  }

  let searchJson = {};
  try {
    searchJson = JSON.parse(oText);
  } catch {
    return NextResponse.json({ step: "orders_search_parse_error", raw: oText }, { status: 200 });
  }

  const results = Array.isArray(searchJson.results) ? searchJson.results : [];
  const enriched = [];

  // 2) Para cada orden, traemos el shipment y filtramos ME1 + Buenos Aires
  for (const o of results) {
    const shipId = o?.shipping?.id;
    let shipment = null;

    if (shipId) {
      const sUrl = `${API}/shipments/${shipId}`;
      const sRes = await fetch(sUrl, { headers: { Authorization: `Bearer ${access}` } });
      const sText = await sRes.text();
      if (sRes.ok) {
        try { shipment = JSON.parse(sText); } catch { /* ignore parse */ }
      } else if (debug) {
        // en debug, devolvemos info del shipment que falló
        console.error("Shipment error:", sRes.status, sText);
      }
    }

    const logistic_type = shipment?.logistic_type || o?.shipping?.logistic_type || o?.shipping?.mode;
    const addr = shipment?.receiver_address;

    if (isME1(logistic_type, o?.shipping?.mode) && isBuenosAires(addr?.state)) {
      enriched.push({
        order_id: o.id,
        buyer_name: `${o?.buyer?.first_name || ""} ${o?.buyer?.last_name || ""}`.trim() || o?.buyer?.nickname,
        phone: o?.buyer?.phone?.number,
        items: (o.order_items || []).map(oi => ({
          title: oi?.item?.title,
          quantity: oi?.quantity,
          sku: oi?.item?.seller_sku
        })),
        shipment: {
          id: shipment?.id,
          state: addr?.state?.name || addr?.state?.id || "",
          city: addr?.city?.name || "",
          address_line: addr?.address_line || "",
          zip: addr?.zip_code || "",
          logistic_type
        }
      });
    }
  }

  const payload = { orders: enriched };
  if (debug) payload._debug = { total_results: results.length };

  return NextResponse.json(payload);
}

function safeParse(t) {
  try { return JSON.parse(t); } catch { return t; }
}
