const BA_STATE_IDS = new Set(["AR-B"]);
const BA_STATE_NAMES = new Set(["Buenos Aires"]);

export function isBuenosAires(receiver_state) {
  if (!receiver_state) return false;
  const idOk = receiver_state.id && BA_STATE_IDS.has(receiver_state.id);
  const nameOk = receiver_state.name && BA_STATE_NAMES.has(receiver_state.name);
  return Boolean(idOk || nameOk);
}

export function isME1(logistic_type, shipping_mode) {
  return logistic_type === "me1" || shipping_mode === "me1";
}