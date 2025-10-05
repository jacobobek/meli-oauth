export const runtime = "nodejs";
export async function GET(){ return new Response("ok"); }
export async function POST(req){
  let body; try{ body = await req.json(); } catch { body = { raw: await req.text() }; }
  console.log("[ML Webhook]", body);
  return Response.json({ status: "received" });
}
