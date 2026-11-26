const CLAVE_ULTIMO_INCIDENTE = "sst-incident-manager:ultimo-incidente-id";

export const guardarUltimoIncidenteId = (id: string): void => {
  window.sessionStorage.setItem(CLAVE_ULTIMO_INCIDENTE, id);
};

export const obtenerUltimoIncidenteId = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage.getItem(CLAVE_ULTIMO_INCIDENTE);
  } catch {
    return null;
  }
};
