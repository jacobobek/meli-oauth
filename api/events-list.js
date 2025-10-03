// /api/events-list.js
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Faltan variables de entorno de Supabase" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // query params
    const limitParam = parseInt(req.query.limit ?? "50", 10);
    const pageParam = parseInt(req.query.page ?? "1", 10);
    const topic = req.query.topic ?? "";
    const q = req.query.q ?? "";

    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;
    const page = Number.isFinite(pageParam) ? Math.max(pageParam, 1) : 1;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("meli_events")
      .select("id, received_at, user_id, topic, resource, payload", { count: "exact" })
      .order("received_at", { ascending: false })
      .range(from, to);

    if (topic) query = query.eq("topic", topic);
    if (q) {
      // Busca por resource, user_id o topic
      // Ojo con comas y %, escapamos básico:
      const safe = String(q).replace(/,/g, " ").replace(/%/g, "");
      query = query.or(
        `resource.ilike.%${safe}%,user_id.ilike.%${safe}%,topic.ilike.%${safe}%`
      );
    }

    const { data, error, count } = await query;

    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json({
      page,
      limit,
      total: count ?? 0,
      items: data ?? [],
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "Error inesperado" });
  }
}
