"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const r = await fetch("/api/orders?debug=1", { cache: "no-store" });
        const j = await r.json();
        if (!r.ok || j.error || j.step) {
          setErr(j.error || `${j.step || "error"} ${j.status || ""}: ${typeof j.body === "string" ? j.body : ""}`);
          setOrders([]);
        } else {
          setOrders(Array.isArray(j.orders) ? j.orders : []);
        }
      } catch (e) {
        setErr(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = () => (window.location.href = "/api/auth");

  const generar = async (items) => {
    const res = await fetch("/api/label", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labels: items }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const generarUna = (o) =>
    generar([{
      order_id: o.order_id, buyer_name: o.buyer_name || "", phone: o.phone || "",
      address_line: o.shipment.address_line || "", city: o.shipment.city || "", state: o.shipment.state || "", zip: o.shipment.zip || "",
      items: o.items || []
    }]);

  const generarTodas = () =>
    generar(orders.map(o => ({
      order_id: o.order_id, buyer_name: o.buyer_name || "", phone: o.phone || "",
      address_line: o.shipment.address_line || "", city: o.shipment.city || "", state: o.shipment.state || "", zip: o.shipment.zip || "",
      items: o.items || []
    })));

  return (
    <main style={{ minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h1>ME1 · Buenos Aires</h1>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={generarTodas}>Generar etiquetas (todas)</button>
            <button onClick={login}>Conectar con Mercado Libre</button>
          </div>
        </header>

        {loading && <p>Cargando órdenes…</p>}
        {err && <p style={{ color: "#b91c1c" }}>Error: {err}</p>}
        {!loading && !err && orders.length === 0 && <p>No hay órdenes ME1 de Provincia de Buenos Aires.</p>}

        <div style={{ display: "grid", gap: 12 }}>
          {orders.map(o => (
            <div key={o.order_id} style={{ background: "#fff", padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <strong>Orden #{o.order_id}</strong>
                  <div>{o.buyer_name} · {o.phone || "Sin teléfono"}</div>
                  <div>{o.shipment.address_line} — {o.shipment.city}, {o.shipment.state} {o.shipment.zip || ""}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>ME1</div>
                </div>
                <button onClick={() => generarUna(o)}>Generar etiqueta</button>
              </div>
              <ul style={{ marginTop: 8 }}>
                {(o.items || []).map((it, i) => (
                  <li key={i}>{it.title} · x{it.quantity}{it.sku ? ` · SKU: ${it.sku}` : ""}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
