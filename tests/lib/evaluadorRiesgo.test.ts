import { describe, expect, it } from "vitest";
import { evaluarRiesgo } from "@/lib/incidentes/evaluadorRiesgo";
import { GRAVEDADES, TIPOS_GTC45 } from "@/types/incidentes";

describe("evaluarRiesgo (matriz de priorización)", () => {
  it.each(["Quimico", "Biologico"] as const)("peligro %s es Alta con atención inmediata en cualquier gravedad", (peligro) => {
    for (const gravedad of GRAVEDADES) {
      expect(evaluarRiesgo(peligro, gravedad)).toEqual({ prioridad_asignada: "Alta", requiere_atencion_inmediata: true });
    }
  });

  it("gravedad Alta es Alta con atención inmediata en cualquier peligro", () => {
    for (const peligro of TIPOS_GTC45) {
      expect(evaluarRiesgo(peligro, "Alta")).toEqual({ prioridad_asignada: "Alta", requiere_atencion_inmediata: true });
    }
  });

  it("gravedad Media en peligro no crítico es Media sin atención inmediata", () => {
    expect(evaluarRiesgo("Biomecanico", "Media")).toEqual({ prioridad_asignada: "Media", requiere_atencion_inmediata: false });
  });

  it("gravedad Baja en peligro no crítico es Baja sin atención inmediata", () => {
    expect(evaluarRiesgo("Fisico", "Baja")).toEqual({ prioridad_asignada: "Baja", requiere_atencion_inmediata: false });
  });

  it("cubre las 21 combinaciones sin lanzar errores y con coherencia", () => {
    for (const peligro of TIPOS_GTC45) {
      for (const gravedad of GRAVEDADES) {
        const r = evaluarRiesgo(peligro, gravedad);
        expect(r.requiere_atencion_inmediata).toBe(r.prioridad_asignada === "Alta");
      }
    }
  });
});
