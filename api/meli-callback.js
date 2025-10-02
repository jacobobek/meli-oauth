export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const code = url.searchParams.get('code');

    if (!code) {
      return res.status(400).json({ error: 'Falta code en la URL' });
    }

    const client_id = process.env.ML_CLIENT_ID;
    const client_secret = process.env.ML_CLIENT_SECRET;
    const redirect_uri = process.env.ML_REDIRECT_URI;

    // Intercambiar code por tokens en Mercado Libre
    const tokenResp = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id,
        client_secret,
        code,
        redirect_uri
      })
    });

    const data = await tokenResp.json();
    if (!tokenResp.ok) {
      console.error('Error tokens:', data);
      return res.status(500).json({ error: 'No se pudo obtener tokens', detail: data });
    }

    console.log('TOKENS_ML', data);

    return res.status(200).send(`¡Autorización OK! user_id=${data.user_id}. Guardá los tokens en tu DB.`);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error en callback', detail: e.message });
  }
}
