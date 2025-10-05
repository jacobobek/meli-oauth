import PDFDocument from "pdfkit";
import { Readable } from "stream";

export function labelsPdfStream(labels) {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 20 });
  const stream = doc;

  const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const pageH = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;

  const cols = 3;
  const colW = pageW / cols;
  const rowH = pageH;

  labels.forEach((label, idx) => {
    if (idx > 0 && idx % 3 === 0) doc.addPage();

    const posInRow = idx % 3;
    const x = doc.page.margins.left + colW * posInRow;
    const y = doc.page.margins.top;

    doc.roundedRect(x + 4, y + 4, colW - 8, rowH - 8, 10).stroke();

    doc.fontSize(14).font("Helvetica-Bold").text(`Orden #${label.order_id}`, x + 14, y + 14, {
      width: colW - 28
    });

    doc.moveDown(0.3);
    doc.fontSize(11).font("Helvetica");
    const addressParts = [
      label.address_line,
      `${label.city}, ${label.state}`,
      label.zip ? `CP: ${label.zip}` : null
    ].filter(Boolean);
    doc.text(addressParts.join(" • "), { width: colW - 28 });
    if (label.phone) doc.text(`Tel: ${label.phone}`);

    doc.moveDown(0.4);
    doc.fontSize(12).font("Helvetica-Bold").text("Ítems:", { width: colW - 28 });

    doc.fontSize(11).font("Helvetica");
    (label.items || []).forEach(it => {
      const sku = it.sku ? ` • SKU: ${it.sku}` : "";
      doc.text(`• ${it.title} — x${it.quantity}${sku}`, { width: colW - 28 });
    });

    doc.moveDown(0.4);
    doc.fontSize(10).fillColor("#555").text("ME1 • Provincia: Buenos Aires", { width: colW - 28 });
    doc.fillColor("#000");
  });

  doc.end();
  return stream;
}