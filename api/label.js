// /api/label.js
import fetch from "node-fetch";
import PDFDocument from "pdfkit";

export default async function handler(req, res) {
  try {
    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    const orderId = searchParams.get("order_id");
    const shippingIdParam = searchParams.get("shipping_id");
    const token = process.env.ML_ACCESS_TOKEN;

    if (!token) return res.status(400).json({ error: "Missing ML_ACCESS_TOKEN" });
    if (!orderId && !shippingIdParam) {
      return res.status(400).json({ error: "You must pass order_id or shipping_id" });
    }

    // 1) Traemos datos de orden si hay order_id
    let order = null;
    if (orderId) {
      const ordUrl = `https://api.mercadolibre.com/orders/${orderId}`;
      const ordResp = await fetch(ordUrl, { headers: { Authorization: `Bearer ${token}` } });
      const ordJson = await ordResp.json();
      if (!ordResp.ok) return res.status(ordResp.status).json(ordJson);
      order = ordJson;
    }

    // 2) shipping_id: desde parámetro o desde la orden
    const shippingId = shippingIdParam || order?.shipping?.id;
    if (!shippingId) {
      return res.status(400).json({ error: "Shipping ID not found for this order." });
    }

    // 3) Traemos detalle de envío
    const shpUrl = `https://api.mercadolibre.com/shipments/${shippingId}`;
    const shpResp = await fetch(shpUrl, { headers: { Authorization: `Bearer ${token}` } });
    const shipment = await shpResp.json();
    if (!shpResp.ok) return res.status(shpResp.status).json(shipment);

    // 4) Datos del producto, SKU y qty desde la orden (si la tenemos)
    let itemTitle = "";
    let sku = "";
    let qty = 1;

    if (order?.order_items?.length) {
      const it = order.order_items[0];
      itemTitle = it?.item?.title || "";
      sku = it?.item?.seller_sku || it?.item?.sku || "";
      qty = it?.quantity || 1;
    }

    // 5) Datos del receptor (comprador) desde shipment
    const recv = shipment?.receiver_address || {};
    const buyerName = recv?.receiver_name || order?.buyer?.nickname || "Comprador";
    const line1 = recv?.address_line || "";
    const city = recv?.city?.name || "";
    const state = recv?.state?.name || "";
    const zip = recv?.zip_code || "";
    const phone = recv?.receiver_phone || recv?.comment || order?.buyer?.phone?.number || "";

    // 6) Datos del vendedor (variables de entorno)
    const SELLER_NAME = process.env.SELLER_NAME || "Tu Tienda";
    const SELLER_PHONE = process.env.SELLER_PHONE || "";
    const SELLER_ADDRESS = process.env.SELLER_ADDRESS || "";
    const SELLER_CUIT = process.env.SELLER_CUIT || "";

    // 7) Configuramos la respuesta como PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=label-${orderId || shippingId}.pdf`);

    // 8) Creamos PDF 4x6 pulgadas (288x432 puntos a 72dpi)
    const doc = new PDFDocument({ size: [288, 432], margin: 12 });
    doc.pipe(res);

    // Marca
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text(SELLER_NAME, { align: "left" });
    doc
      .fontSize(9)
      .font("Helvetica")
      .text(SELLER_ADDRESS)
      .text(SELLER_PHONE ? `Tel: ${SELLER_PHONE}` : "")
      .text(SELLER_CUIT ? `CUIT: ${SELLER_CUIT}` : "");

    // Separador
    doc.moveDown(0.5).lineWidth(1).moveTo(12, doc.y).lineTo(276, doc.y).stroke().moveDown(0.5);

    // Producto en primera línea (destacado)
    doc.font("Helvetica-Bold").fontSize(12).text(`Producto: ${itemTitle}`);
    doc.font("Helvetica").fontSize(10).text(`SKU: ${sku || "-"}`);
    doc.fontSize(10).text(`Cantidad: ${qty}`);

    // Otro separador
    doc.moveDown(0.5).lineWidth(1).moveTo(12, doc.y).lineTo(276, doc.y).stroke().moveDown(0.5);

    // Dirección de entrega
    doc.font("Helvetica-Bold").fontSize(12).text("DESTINATARIO", { continued: false });
    doc.font("Helvetica").fontSize(11).text(buyerName);
    doc.fontSize(10).text(line1);
    doc.fontSize(10).text(`${city}, ${state} - CP ${zip}`);
    if (phone) doc.fontSize(10).text(`Tel: ${phone}`);

    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(9).text(`Orden: ${orderId || "-"}`);
    doc.font("Helvetica").fontSize(9).text(`Envío: ${shippingId}`);

    // Área para notas o código
    doc.moveDown(0.5).roundedRect(12, doc.y, 264, 80, 6).stroke();
    doc.font("Helvetica").fontSize(9).text("Notas:", 18, doc.y + 6);
    // podríamos incluir instrucción de manejo, etc.

    // Al pie, una “faja” con grande CP para referencia visual
    doc.save();
    doc.rect(12, 432 - 42, 264, 30).fill("#0b1220");
    doc.fill("#ffffff").font("Helvetica-Bold").fontSize(18).text(`CP ${zip || "----"}`, 12, 432 - 38, {
      width: 264, align: "center"
    });
    doc.restore();

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unexpected error", details: err.message });
  }
}
