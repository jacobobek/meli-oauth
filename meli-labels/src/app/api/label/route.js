import { NextResponse } from "next/server";
import { labelsPdfStream } from "../../../lib/pdf.js";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const labels = Array.isArray(body?.labels) ? body.labels : [];
  if (!labels.length) return NextResponse.json({ error: "Sin etiquetas" }, { status: 400 });

  const stream = labelsPdfStream(labels);

  const chunks = [];
  await new Promise((resolve, reject) => {
    stream.on("data", (c) => chunks.push(c));
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });

  return new NextResponse(Buffer.concat(chunks), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=\"etiquetas.pdf\""
    }
  });
}