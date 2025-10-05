import { cookies } from "next/headers";
import { isME1, isBuenosAires } from "../../../lib/filters.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API = "https://api.mercadolibre.com";

export async function GET(req) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";

  const access = cookies().get("meli_access_token")?.value || null;
  if (!access) return json({ error: "no_access_token" }, 401);

  try {
    const searchUrl = `${API}/orders/search?seller=me&order.status=paid&sort=date_desc&limit=50`;
    const oRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${access}` } });
    const oText = await oRes.text();

    if (!oRes.ok) {
      return json({ step: "orders_search", status: oRes.status, url: searchUrl, body: safe(oText) }, 200);
    }

    const search = safe(oText);
    const results = Array.isArray(search?.results) ? search.results : [];
    const enriched = [];

    for (const o of results) {
      const shipId = o?.shipping?.id;
      let shipment = null;

      if (shipId) {
        const sRes = await fetch(`${API}/shipments/${shipId}`, { headers: { Authorization: `Bearer ${access}` } });
        const sText = await sRes.text();
        if (sRes.ok) shipment = safe(sText);
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
    return json(payload, 200);
  } catch (e) {
    return json({ step: "unexpected_error", message: String(e) }, 200);
  }
}

function safe(t) { try { return JSON.parse(t); } catch { return t; } }
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
