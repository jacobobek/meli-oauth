export function isME1(logistic_type, mode) {
  return logistic_type === "me1" || mode === "me1";
}

export function isBuenosAires(state) {
  if (!state) return false;
  const id = state.id || "";
  const name = state.name || "";
  return id === "AR-B" || name === "Buenos Aires";
}
