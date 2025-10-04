// api/orders.js
export default async function handler(req, res) {
  try {
    const { mode = 'me1,custom', payment = 'approved', limit = 50 } = req.query;

    // Datos de ejemplo (luego los cambiarás por la API real)
    const mockOrders = [
      {
        id: "MLA001",
        buyer: "Juan Pérez",
        payment_status: "approved",
        amount: 18999,
        shipping_type: "me1",
        product: "Tijera de Peluquería Zeat RS5022 x1",
      },
      {
        id: "MLA002",
        buyer: "María López",
        payment_status: "approved",
        amount: 5500,
        shipping_type: "custom",
        product: "Aspersor 5035 con soporte x2",
      }
    ];

    res.status(200).json(mockOrders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}
