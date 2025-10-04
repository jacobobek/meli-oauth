// /api/orders-to-ship.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    const { ML_USER_ID, ML_ACCESS_TOKEN } = process.env; // o leelo desde Supabase
    if (!ML_USER_ID || !ML_ACCESS_TOKEN) {
      return res.status(500).json({ error: 'Faltan ML_USER_ID o ML_ACCESS_TOKEN' });
    }

    // 1) Buscar órdenes "recent" del vendedor. Podés paginar si querés más.
    // Docs: GET /orders/search?seller={user_id}&order.status=paid
    const qs = new URLSearchParams({
      seller: ML_USER_ID,
      sort: 'date_desc',
      limit: '50'
    });
    const url = `https://api.mercadolibre.com/orders/search?${qs.toString()}`;

    const r = await fetch(url, { headers: { Authorization: `Bearer ${ML_ACCESS_TOKEN}` }});
    const j = await r.json();
    if (!r.ok) return res.status(r.status).json(j);

    const out = [];

    for (const o of (j.results || [])) {
      // Saca info de shipping
      const ship = o?.shipping || {};
      const logistic = ship.logistic_type || ship.mode || ''; // "me1" / "custom" / "xd_drop_off" / "me2"...
      if (!(logistic === 'me1' || logistic === 'custom')) continue;

      // Pago: si hay payments, toma el último/aprobado
      const pay = (o.payments || [])[0] || {};
      const payStatus = pay?.status || o?.order_status || '—';
      // Solo listamos, el front decide si habilita imprimir cuando "approved"

      // Item (primer item de la orden)
      const it = (o.order_items && o.order_items[0]) || {};
      const title = it?.item?.title || it?.item?.seller_sku || '—';

      out.push({
        id: o.id,
        shipping_type: logistic === 'me1' ? 'me1' : 'custom',
        shipment_id: ship?.id || null,
        payment_status: payStatus,
        buyer: o?.buyer?.nickname || o?.buyer?.first_name || '',
        item_title: title,
        date_created: o?.date_created
      });
    }

    res.status(200).json(out);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Error' });
  }
}
