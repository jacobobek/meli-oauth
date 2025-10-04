// /api/meli/label.js
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

export default async (req, res) => {
  try {
    const { shipment_id } = req.body || {};
    if (!shipment_id) return res.status(400).json({ error: 'shipment_id requerido' });

    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: row } = await supa.from('meli_tokens').select('*').limit(1).single();
    const access_token = row?.access_token;
    if (!access_token) return res.status(401).json({ error: 'falta token' });

    // Doc: https://api.mercadolibre.com/shipment_labels?shipment_ids=xxx&response_type=pdf
    const url = `https://api.mercadolibre.com/shipment_labels?shipment_ids=${shipment_id}&response_type=pdf`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
    if (!r.ok) return res.status(r.status).json(await r.json());

    // opción simple: redirigir a la URL pública (ML genera PDF)
    // si el response ya es PDF directo, podrías pipearlo; aquí devolvemos la URL usada:
    res.json({ url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};
