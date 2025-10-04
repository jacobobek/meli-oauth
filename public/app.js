// /public/app.js
const $ = s => document.querySelector(s);
const tbody = $("#tbody");
const filterKind = $("#filterKind");
const q = $("#q");
const reloadBtn = $("#reload");

let cache = [];

function fmtDate(d) {
  try { return new Date(d).toLocaleString("es-AR"); } catch { return d || ""; }
}
function money(n) {
  const x = Number(n || 0);
  try { return x.toLocaleString("es-AR", { style: "currency", currency: "ARS" }); }
  catch { return `$ ${x.toFixed(2)}`; }
}
function render() {
  const kind = filterKind.value.trim().toUpperCase();
  const needle = q.value.trim().toLowerCase();

  const rows = cache.filter(r => {
    const okKind = !kind || (r.kind || "").toUpperCase() === kind;
    const hay = `${r.id} ${r.buyer} ${r.sku} ${r.title}`.toLowerCase();
    const okQ = !needle || hay.includes(needle);
    return okKind && okQ;
  });

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td class="mono">${r.id}</td>
      <td>${fmtDate(r.date_created)}</td>
      <td>${r.buyer || ""}</td>
      <td>${r.kind}</td>
      <td>${r.status || ""}</td>
      <td>${r.title || ""}</td>
      <td class="mono">${r.sku || ""}</td>
      <td class="mono">${r.quantity || 1}</td>
      <td class="mono">${money(r.total_amount)}</td>
      <td>
        <button data-act="label" data-order="${r.id}" data-ship="${r.shipping_id || ""}">Etiqueta</button>
        <button data-act="ship" data-ship="${r.shipping_id || ""}">Marcar despachado</button>
      </td>
    </tr>
  `).join("");
}

async function load() {
  const r = await fetch("/api/orders", { cache: "no-store" });
  cache = await r.json();
  render();
}

document.addEventListener("click", async (ev) => {
  const b = ev.target.closest("button[data-act]");
  if (!b) return;
  const act = b.dataset.act;
  const orderId = b.dataset.order;
  const shippingId = b.dataset.ship;

  if (act === "label") {
    if (orderId) window.open(`/api/label?order_id=${orderId}`, "_blank");
    else if (shippingId) window.open(`/api/label?shipping_id=${shippingId}`, "_blank");
    else alert("No hay order_id ni shipping_id");
  }

  if (act === "ship") {
    if (!shippingId) return alert("La orden no tiene shipping_id");
    b.disabled = true;
    try {
      const r = await fetch(`/api/mark-shipped?shipping_id=${shippingId}`);
      const j = await r.json();
      if (r.ok) {
        alert("Marcado como listo para despachar (si ML lo admite).");
        await load();
      } else {
        console.error(j);
        alert("No se pudo marcar: " + (j?.error || "Error"));
      }
    } finally {
      b.disabled = false;
    }
  }
});

filterKind.addEventListener("change", render);
q.addEventListener("input", render);
reloadBtn.addEventListener("click", load);

load();
