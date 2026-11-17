import { describe, expect, it } from "vitest";
import { evaluarRiesgo } from "@/lib/incidentes/evaluadorRiesgo";
import type { ClasificacionRiesgo } from "@/lib/incidentes/modelo";
import { GRAVEDADES, TIPOS_GTC45, type Gravedad } from "@/types/incidentes";


type Prioridad = ClasificacionRiesgo["prioridad_asignada"];


const resultado = (prioridad: Prioridad) => ({
  prioridad_asignada: prioridad,
  requiere_atencion_inmediata: prioridad === "Alta",
});


/** Salida esperada por peligro y gravedad (debe coincidir con la matriz del evaluador). */
const MATRIZ_ESPERADA: Record<string, Record<Gravedad, Prioridad>> = {
  Biologico: { Baja: "Alta", Media: "Alta", Alta: "Alta" },
  Quimico: { Baja: "Alta", Media: "Alta", Alta: "Alta" },
  Seguridad: { Baja: "Media", Media: "Alta", Alta: "Alta" },
  "Fenomeno natural": { Baja: "Media", Media: "Alta", Alta: "Alta" },
  Fisico: { Baja: "Media", Media: "Media", Alta: "Alta" },
  Biomecanico: { Baja: "Baja", Media: "Media", Alta: "Alta" },
  Psicosocial: { Baja: "Baja", Media: "Media", Alta: "Alta" },
};


const COMBINACIONES = TIPOS_GTC45.flatMap((peligro) => GRAVEDADES.map((gravedad) => [peligro, gravedad] as const));


describe("evaluarRiesgo (matriz de priorización)", () => {
  it.each(["Quimico", "Biologico"] as const)("peligro %s es Alta con atención inmediata en cualquier gravedad", (peligro) => {
    for (const gravedad of GRAVEDADES) {
      expect(evaluarRiesgo(peligro, gravedad)).toEqual(resultado("Alta"));
    }
  });


  it("gravedad Alta es Alta con atención inmediata en cualquier peligro", () => {
    for (const peligro of TIPOS_GTC45) {
      expect(evaluarRiesgo(peligro, "Alta")).toEqual(resultado("Alta"));
    }
  });


  it.each(["Seguridad", "Fenomeno natural"] as const)("peligro %s: Baja es Media y Media es Alta con atención inmediata", (peligro) => {
    expect(evaluarRiesgo(peligro, "Baja")).toEqual(resultado("Media"));
    expect(evaluarRiesgo(peligro, "Media")).toEqual(resultado("Alta"));
  });


  it("peligro Fisico: Baja y Media son Media sin atención inmediata", () => {
    expect(evaluarRiesgo("Fisico", "Baja")).toEqual(resultado("Media"));
    expect(evaluarRiesgo("Fisico", "Media")).toEqual(resultado("Media"));
  });


  it.each(["Biomecanico", "Psicosocial"] as const)("peligro %s: la prioridad sigue la gravedad (Baja y Media)", (peligro) => {
    expect(evaluarRiesgo(peligro, "Baja")).toEqual(resultado("Baja"));
    expect(evaluarRiesgo(peligro, "Media")).toEqual(resultado("Media"));
  });


  it("la matriz esperada cubre exactamente los tipos GTC 45", () => {
    expect(Object.keys(MATRIZ_ESPERADA).sort()).toEqual([...TIPOS_GTC45].sort());
  });


  it.each(COMBINACIONES)("combinación %s + gravedad %s devuelve la salida esperada", (peligro, gravedad) => {
    expect(evaluarRiesgo(peligro, gravedad)).toEqual(resultado(MATRIZ_ESPERADA[peligro][gravedad]));
  });
});