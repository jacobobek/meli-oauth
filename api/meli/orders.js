// api/meli/orders.js
const { createClient } = require('@supabase/supabase-js');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Helper: obtiene el primer token válido (o por user_id si viene en query)
async function getToken(user_id) {
  const q = supabase.from('meli_tokens').select('*').order('created_at', { ascending: false });

  if (user_id) q.eq('user_id', user_id);

  const { data, error } = await q.limit(1).maybeSingle();
  if (error || !data) throw new Error('No se encontró token en meli_tokens');
  return data; // { access_token, refresh_token, user_id, created_at }
}

// Mapea una orden a un formato uniforme para el front
function mapOrder(o) {
  const item = (o.order_items && o.order_items[0]) || {};
  const itemTitle = item.item?.title || item.item?.title || '';
  const sku = item.item?.seller_sku || item.item?.seller_custom_field || '';
  const qty = item.quantity || 1;

  // pago "aprobado" si alguno de los payments está approved
  const payments = Array.isArray(o.payments) ? o.payments : [];
  const isApproved = payments.some(p => p.status === 'approved');

  // buyer
  const buyer = o.buyer || {};
  const buyerName = [buyer.first_name, buyer.last_name].filter(Boolean).join(' ') || buyer.nickname || '';
  const buyerId = buyer.id || '';

  // shipping
  const shipping = o.shipping || {};
  const shipMode = shipping.mode || '';       // 'me1' | 'custom' | 'me2'
  const shipStatus = shipping.status || '';

  // Monto
  const total = o.total_amount || 0;

  return {
    order_id: o.id,
    date_created: o.date_created,
    buyer: { id: buyerId, name: buyerName },
    payment: isApproved ? 'approved' : (payments[0]?.status || 'pending'),
    amount: total,
    shipping: { mode: shipMode, status: shipStatus },
    item: { title: itemTitle, sku, qty }
  };
}

module.exports = async (req, res) => {
  try {
    // Query params
    const url = new URL(req.url, `http://${req.headers.host}`);
    const modes = (url.searchParams.get('mode') || 'me1,custom')
      .split(',')
      .map(s => s.trim().toLowerCase()); // e.g. ['me1','custom']
    const paymentsFilter = (url.searchParams.get('payments') || 'approved').toLowerCase(); // approved|pending|all
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
    const userParam = url.searchParams.get('user_id') || null;

    // 1) Token + user_id
    const tokenRow = await getToken(userParam);
    const access_token = tokenRow.access_token;
    const user_id = tokenRow.user_id;

    // 2) Mercado Libre orders/search
    //   Ordenadas descendente, incluyen order_items y shipping
    const mlUrl = new URL('https://api.mercadolibre.com/orders/search');
    mlUrl.searchParams.set('seller', String(user_id));
    mlUrl.searchParams.set('sort', 'date_desc');
    mlUrl.searchParams.set('limit', String(limit));

    const r = await fetch(mlUrl.toString(), {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`ML orders error ${r.status}: ${t}`);
    }
    const json = await r.json();
    const results = Array.isArray(json.results) ? json.results : [];

    // 3) Mapeo y filtros en server
    let orders = results.map(mapOrder);

    // Filtro por mode (me1/custom)
    if (modes.length && !modes.includes('all')) {
      orders = orders.filter(o => modes.includes((o.shipping.mode || '').toLowerCase()));
    }

    // Filtro por pagos
    if (paymentsFilter !== 'all') {
      orders = orders.filter(o => {
        const approved = o.payment === 'approved';
        return paymentsFilter === 'approved' ? approved : !approved;
      });
    }

    // Búsqueda
    if (q) {
      orders = orders.filter(o => {
        const haystack = [
          o.order_id,
          o.buyer?.name || '',
          o.item?.title || '',
          o.item?.sku || ''
        ].join(' ').toLowerCase();
        return haystack.includes(q);
      });
    }

    res.status(200).json({ ok: true, count: orders.length, orders });
  } catch (err) {
    console.error('orders.js error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};
