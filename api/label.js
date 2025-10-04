// /api/label.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    const { ML_ACCESS_TOKEN } = process.env;
    const { shipment_id } = req.query;
    if (!shipment_id) return res.status(400).json({ error: 'shipment_id requerido' });
    if (!ML_ACCESS_TOKEN) return res.status(500).json({ error: 'Falta ML_ACCESS_TOKEN' });

    const url = `https://api.mercadolibre.com/shipments/${shipment_id}/labels?response_type=pdf`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${ML_ACCESS_TOKEN}` }});
    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).send(t);
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="label_${shipment_id}.pdf"`);
    res.status(200).send(buf);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Error' });
  }
}
