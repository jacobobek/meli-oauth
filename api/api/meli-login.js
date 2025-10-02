export default function handler(req, res) {
  const clientId = process.env.ML_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.ML_REDIRECT_URI);

  // Cambiá el dominio según tu país (.com.ar, .com.mx, .com.br, etc.)
  const authUrl = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`;
  
  res.writeHead(302, { Location: authUrl });
  res.end();
}
