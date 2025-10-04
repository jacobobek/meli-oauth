// /api/label.js
import fetch from "node-fetch";
import PDFDocument from "pdfkit";

const ML_API = "https://api.mercadolibre.com";

export default async function handler(req, res) {
  try {
    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    const orderId = searchParams.get("order_id");
    const shippingIdParam = searchParams.get("shipping_id");
    const token = process.env.ML_ACCESS_TOKEN;

    if (!token) return res.status(400).json({ error: "Falta ML_ACCESS_TOKEN" });
    if (!orderId && !shippingIdParam) {
      return res.status(400).json({ error: "Debes pasar order_id o shipping_id" });
    }

    // 1) Orden (si hay order_id)
    let order = null;
    if (orderId) {
      const ordUrl = `${ML_API}/orders/${orderId}`;
      const ordResp = await fetch(ordUrl, { headers: { Authorization: `Bearer ${token}` } });
      const ordJson = await ordResp.json();
      if (!ordResp.ok) return res.status(ordResp.status).json(ordJson);
      order = ordJson;
    }

    // 2) Shipping ID (del parámetro o de la orden)
    const shippingId = shippingIdParam || order?.shipping?.id;
    if (!shippingId) {
      return res.status(400).json({ error: "No se encontró shipping_id" });
    }

    // 3) Detalle de envío
    const shpUrl = `${ML_API}/shipments/${shippingId}`;
    const shpResp = await fetch(shpUrl, { headers: { Authorization: `Bearer ${token}` } });
    const shipment = await shpResp.json();
    if (!shpResp.ok) return res.status(shpResp.status).json(shipment);

    // 4) Producto/SKU/Cantidad
    let itemTitle = "";
    let sku = "";
    let qty = 1;

    if (order?.order_items?.length) {
      const it = order.order_items[0];
      itemTitle = it?.item?.title || "";
      sku = it?.item?.seller_sku || it?.item?.sku || "";
      qty = it?.quantity || 1;
    }

    // 5) Receptor
    const recv = shipment?.receiver_address || {};
    const buyerName = recv?.receiver_name || order?.buyer?.nickname || "Comprador";
    const line1 = recv?.address_line || "";
    const city = recv?.city?.name || "";
    const state = recv?.state?.name || "";
    const zip = recv?.zip_code || "";
    const phone = recv?.receiver_phone || recv?.comment || order?.buyer?.phone?.number || "";

    // 6) Vendedor (ENV)
    const SELLER_NAME = process.env.SELLER_NAME || "Tu Tienda";
    const SELLER_PHONE = process.env.SELLER_PHONE || "";
    const SELLER_ADDRESS = process.env.SELLER_ADDRESS || "";
    const SELLER_CUIT = process.env.SELLER_CUIT || "";

    // 7) PDF headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=label-${orderId || shippingId}.pdf`);

    // 8) PDF 4x6" (288 x 432 pt)
    const doc = new PDFDocument({ size: [288, 432], margin: 12 });
    doc.pipe(res);

    // Seller
    doc.fontSize(16).font("Helvetica-Bold").text(SELLER_NAME);
    doc.fontSize(9).font("Helvetica").text(SELLER_ADDRESS);
    if (SELLER_PHONE) doc.text(`Tel: ${SELLER_PHONE}`);
    if (SELLER_CUIT) doc.text(`CUIT: ${SELLER_CUIT}`);

    doc.moveDown(0.5).lineWidth(1).moveTo(12, doc.y).lineTo(276, doc.y).stroke().moveDown(0.5);

    // Producto / SKU / Cantidad
    doc.font("Helvetica-Bold").fontSize(12).text(`Producto: ${itemTitle}`);
    doc.font("Helvetica").fontSize(10).text(`SKU: ${sku || "-"}`);
    doc.fontSize(10).text(`Cantidad: ${qty}`);

    doc.moveDown(0.5).lineWidth(1).moveTo(12, doc.y).lineTo(276, doc.y).stroke().moveDown(0.5);

    // Destinatario
    doc.font("Helvetica-Bold").fontSize(12).text("DESTINATARIO");
    doc.font("Helvetica").fontSize(11).text(buyerName);
    doc.fontSize(10).text(line1);
    doc.fontSize(10).text(`${city}, ${state} - CP ${zip}`);
    if (phone) doc.fontSize(10).text(`Tel: ${phone}`);

    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(9).text(`Orden: ${orderId || "-"}`);
    doc.font("Helvetica").fontSize(9).text(`Envío: ${shippingId}`);

    // Caja de notas
    doc.moveDown(0.5).roundedRect(12, doc.y, 264, 78, 6).stroke();
    doc.font("Helvetica").fontSize(9).text("Notas:", 18, doc.y + 6);

    // Faja con CP
    doc.save();
    doc.rect(12, 432 - 42, 264, 30).fill("#0b1220");
    doc.fill("#ffffff").font("Helvetica-Bold").fontSize(18).text(`CP ${zip || "----"}`, 12, 432 - 38, {
      width: 264, align: "center"
    });
    doc.restore();

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error inesperado", details: err.message });
  }
}
