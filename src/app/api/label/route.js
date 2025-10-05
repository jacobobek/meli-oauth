export const runtime = "nodejs";

export async function POST(req) {
  const { labels } = await req.json().catch(() => ({}));
  if (!Array.isArray(labels) || !labels.length) {
    return Response.json({ error: "Sin etiquetas" }, { status: 400 });
  }

  // pdfkit en ESM: import dinámico
  const PDFKit = (await import("pdfkit")).default;
  const { PassThrough } = await import("node:stream");

  const stream = new PassThrough();
  const doc = new PDFKit({ size: "A4", layout: "landscape", margins: { top: 20, bottom: 20, left: 20, right: 20 }});
  doc.pipe(stream);

  const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const pageH = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
  const colW = pageW / 3;

  labels.forEach((label, idx) => {
    if (idx > 0 && idx % 3 === 0) doc.addPage();
    const pos = idx % 3;
    const x = doc.page.margins.left + colW * pos;
    const y = doc.page.margins.top;

    doc.roundedRect(x + 4, y + 4, colW - 8, pageH - 8, 10).stroke();
    doc.font("Helvetica-Bold").fontSize(16).text(`Orden #${label.order_id}`, x + 12, y + 10, { width: colW - 24 });

    doc.font("Helvetica").fontSize(11).text(
      [
        label.buyer_name || "",
        `${label.address_line || ""}`,
        `${label.city || ""}, ${label.state || ""} ${label.zip || ""}`.trim(),
        label.phone ? `Tel: ${label.phone}` : ""
      ].filter(Boolean).join("\n"),
      x + 12, y + 40, { width: colW - 24 }
    );

    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").fontSize(12).text("Ítems:", x + 12, undefined, { width: colW - 24 });
    doc.font("Helvetica").fontSize(11);
    (label.items || []).forEach(it => {
      const sku = it.sku ? ` · SKU: ${it.sku}` : "";
      doc.text(`• ${it.title} — x${it.quantity}${sku}`, { width: colW - 24 });
    });

    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#555").text("ME1 · Provincia: Buenos Aires", { width: colW - 24 });
    doc.fillColor("#000");
  });

  doc.end();

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=etiquetas.pdf"
    }
  });
}
