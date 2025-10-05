"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/orders");
        if (!res.ok) return;
        const json = await res.json();
        setOrders(json.orders || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = () => (window.location.href = "/api/auth");

  const generarEtiqueta = async (o) => {
    const labels = [
      {
        order_id: o.order_id,
        buyer_name: o.buyer_name || "",
        phone: o.phone,
        address_line: o.shipment.address_line || "",
        city: o.shipment.city || "",
        state: o.shipment.state || "",
        zip: o.shipment.zip || "",
        items: o.items
      }
    ];
    const res = await fetch("/api/label", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labels })
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const generarMultiples = async () => {
    if (!orders.length) return;
    const labels = orders.map((o) => ({
      order_id: o.order_id,
      buyer_name: o.buyer_name || "",
      phone: o.phone,
      address_line: o.shipment.address_line || "",
      city: o.shipment.city || "",
      state: o.shipment.state || "",
      zip: o.shipment.zip || "",
      items: o.items
    }));
    const res = await fetch("/api/label", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labels })
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  return (
    <main className="min-h-screen" style={{ background: "#f7f7f8" }}>
      <div className="mx-auto" style={{ maxWidth: 1100, padding: "40px 24px" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: "#0f172a" }}>Etiquetas ME1 · Buenos Aires</h1>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={generarMultiples}
              style={{ borderRadius: 12, background: "#111827", color: "#fff", padding: "8px 14px", fontSize: 14 }}
              title="Generar un PDF con todas las etiquetas (3 por hoja A4)"
            >
              Generar etiquetas (todas)
            </button>
            <button
              onClick={login}
              style={{ borderRadius: 12, border: "1px solid #d1d5db", padding: "8px 14px", fontSize: 14 }}
            >
              Conectar con Mercado Libre
            </button>
          </div>
        </header>

        {loading ? (
          <p style={{ color: "#475569" }}>Cargando órdenes…</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
            {orders.map((o) => (
              <div key={o.order_id} style={{
                borderRadius: 16, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb", padding: 20
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <h2 style={{ fontWeight: 600, color: "#0f172a" }}>Orden #{o.order_id}</h2>
                    <p style={{ fontSize: 14, color: "#475569" }}>
                      {o.buyer_name} · {o.phone ? `Tel: ${o.phone}` : "Sin teléfono"}
                    </p>
                    <p style={{ fontSize: 14, color: "#475569" }}>
                      {o.shipment.address_line} — {o.shipment.city}, {o.shipment.state} {o.shipment.zip || ""}
                    </p>
                    <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                      Envío: {o.shipment.logistic_type || o.shipment.mode} (ME1)
                    </p>
                  </div>
                  <button
                    onClick={() => generarEtiqueta(o)}
                    style={{ borderRadius: 12, background: "#4f46e5", color: "#fff", padding: "8px 12px", fontSize: 14 }}
                    title="Generar etiqueta en PDF (3 por hoja A4)"
                  >
                    Generar etiqueta
                  </button>
                </div>
                <div style={{ marginTop: 12, borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
                  <ul style={{ fontSize: 14, color: "#111827", listStyle: "none", padding: 0, margin: 0 }}>
                    {o.items.map((it, idx) => (
                      <li key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</span>
                        <span style={{ color: "#475569" }}>x{it.quantity}{it.sku ? ` · SKU: ${it.sku}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
            {!orders.length && <p style={{ color: "#475569" }}>No hay órdenes ME1 en Buenos Aires.</p>}
          </div>
        )}
      </div>
    </main>
  );
}