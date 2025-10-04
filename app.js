// app.js

function fmtMoney(n){
  if(n == null || isNaN(n)) return '—';
  try { return Number(n).toLocaleString('es-AR',{style:'currency',currency:'ARS'}); }
  catch { return `$ ${Number(n).toFixed(2)}`; }
}

function fmtDate(d){
  if(!d) return '—';
  try { return new Date(d).toLocaleString('es-AR'); }
  catch { return String(d); }
}
