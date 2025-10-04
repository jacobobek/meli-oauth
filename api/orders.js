// /api/meli/orders.js
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

export default async (req, res) => {
  try {
    const { mode = 'me1,custom', payment = 'approved', limit = 50 } = req.query;

    // 1) Cargar access_token desde tu base Supabase
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: row } = await supa.from('meli_tokens').select('*').limit(1).single();
    const access_token = row?.access_token;
    if (!access_token) return res.status(401).json({ error: 'falta token' });

    // 2) Consultar las órdenes en Mercado Libre
    const seller_id = row.user_id;
    const url = new URL('https://api.mercadolibre.com/orders/search');
    url.searchParams.set('seller', seller_id);
    url.searchParams.set('order_status', 'paid'); // buscar órdenes pagas
    url.searchParams.set('limit', limit);

    const r = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
    const json = await r.json();

    const modes = mode.split(',').map(s => s.trim());
    const list = (json.results || []).map(o => {
      const first = o.order_items?.[0];
      const p = o.payments?.[0];
      return {
        order_id: o.id,
        buyer: o.buyer?.nickname || o.buyer?.first_name || '',
        payment_status: p?.status || 'pending',
        total_amount: o.total_amount,
        shipping_mode: o.shipping?.shipping_mode || 'custom',
        shipment_id: o.shipping?.id || null,
        title: first?.item?.title || '',
        date_created: o.date_created
      };
    })
    .filter(x => modes.includes(x.shipping_mode))
    .filter(x => payment === 'all' ? true : x.payment_status === payment);

    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};
