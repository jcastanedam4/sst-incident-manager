import { normalizarEstado, obtenerEstadosPersistencia } from "@/types/incidentes";

describe("types/incidentes", () => {
  describe("obtenerEstadosPersistencia", () => {
    it("devuelve el estado recibido como único candidato", () => {
      expect(obtenerEstadosPersistencia("Abierto")).toEqual(["Abierto"]);
      expect(obtenerEstadosPersistencia("En Proceso")).toEqual(["En Proceso"]);
      expect(obtenerEstadosPersistencia("Cerrado")).toEqual(["Cerrado"]);
    });
  });

  describe("normalizarEstado", () => {
    it("normaliza estados abiertos", () => {
      expect(normalizarEstado("abierto")).toBe("Abierto");
      expect(normalizarEstado("  Abierto  ")).toBe("Abierto");
      expect(normalizarEstado("pendiente")).toBe("Abierto");
    });

    it("normaliza estados en proceso", () => {
      expect(normalizarEstado("en proceso")).toBe("En Proceso");
      expect(normalizarEstado("en_revision")).toBe("En Proceso");
      expect(normalizarEstado("en revisión")).toBe("En Proceso");
    });

    it("cae en cerrado para cualquier otro valor", () => {
      expect(normalizarEstado("cerrado")).toBe("Cerrado");
      expect(normalizarEstado("desconocido")).toBe("Cerrado");
      expect(normalizarEstado("")).toBe("Cerrado");
    });
  });
});
