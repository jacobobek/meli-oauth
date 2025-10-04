// /api/me.js
export default async function handler(req, res) {
  try {
    const { SESSION_COOKIE_NAME = "meli_uid" } = process.env;
    const cookie = req.headers.cookie || "";
    const match = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    const user_id = match ? decodeURIComponent(match[1]) : null;
    res.status(200).json({ user_id });
  } catch (e) {
    res.status(200).json({ user_id: null });
  }
}
