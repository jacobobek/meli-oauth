import { NextResponse } from "next/server";
import { getAccessTokenFromCookies, meliGet } from "../../../lib/meli.js";
import { isME1, isBuenosAires } from "../../../lib/filters.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = getAccessTokenFromCookies();
  if (!access) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const search = await meliGet(`/orders/search?seller=me&order.status=paid&sort=date_desc&limit=50`, access);
  const orders = search.results || [];

  const enriched = [];
  for (const o of orders) {
    const shipId = o?.shipping?.id;
    let shipment = null;
    if (shipId) {
      try {
        shipment = await meliGet(`/shipments/${shipId}`, access);
      } catch {
        // ignoramos errores individuales de shipments
      }
    }
    const logistic_type = shipment?.logistic_type || o?.shipping?.logistic_type;
    const mode = shipment?.mode || o?.shipping?.mode;
    const addr = shipment?.receiver_address;

    if (isME1(logistic_type, mode) && isBuenosAires(addr?.state)) {
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
          logistic_type,
          mode
        }
      });
    }
  }

  return NextResponse.json({ orders: enriched });
}
