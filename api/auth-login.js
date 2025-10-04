// /api/auth-login.js
export default async function handler(req, res) {
  try {
    const { ML_CLIENT_ID, ML_REDIRECT_URI } = process.env;
    if (!ML_CLIENT_ID || !ML_REDIRECT_URI) {
      return res.status(500).json({ error: "Faltan env vars ML_CLIENT_ID/ML_REDIRECT_URI" });
    }
    const scope = encodeURIComponent("offline_access read write");
    const url = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${ML_CLIENT_ID}&redirect_uri=${encodeURIComponent(ML_REDIRECT_URI)}&scope=${scope}`;
    res.writeHead(302, { Location: url });
    res.end();
  } catch (e) {
    res.status(500).json({ error: e?.message || "Error auth login" });
  }
}
