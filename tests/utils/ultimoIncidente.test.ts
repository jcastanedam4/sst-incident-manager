import { guardarUltimoIncidenteId, obtenerUltimoIncidenteId } from "@/utils/ultimoIncidente";

describe("ultimo incidente de la sesión", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("conserva el identificador de registro para recuperarlo tras recargar", () => {
    guardarUltimoIncidenteId("incidente-123");

    expect(obtenerUltimoIncidenteId()).toBe("incidente-123");
  });

  it("devuelve null si todavía no se ha guardado un incidente", () => {
    expect(obtenerUltimoIncidenteId()).toBeNull();
  });
});
