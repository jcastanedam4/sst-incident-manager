import { describe, expect, it } from "vitest";
import { ErrorValidacion } from "@/lib/incidentes/errores";
import { validarIdIncidente, validarNuevoIncidente } from "@/lib/incidentes/validacion";

const valido = { titulo: "Derrame", descripcion: "Sustancia en piso", tipo_peligro: "Quimico", gravedad: "Alta" };

const campos = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (e) {
    if (e instanceof ErrorValidacion) return e.detalles.map((d) => d.campo);
    throw e;
  }
  return [];
};

describe("validarNuevoIncidente", () => {
  it("acepta datos válidos y recorta espacios", () => {
    expect(validarNuevoIncidente({ ...valido, titulo: "  Derrame  " }).titulo).toBe("Derrame");
  });

  it("ignora una prioridad enviada por el cliente", () => {
    const r = validarNuevoIncidente({ ...valido, prioridad_asignada: "Baja" }) as Record<string, unknown>;
    expect(r.prioridad_asignada).toBeUndefined();
  });

  it("rechaza campos obligatorios ausentes", () => {
    expect(campos(() => validarNuevoIncidente({}))).toEqual(["titulo", "descripcion", "tipo_peligro", "gravedad"]);
  });

  it("rechaza título solo con espacios", () => {
    expect(campos(() => validarNuevoIncidente({ ...valido, titulo: "   " }))).toEqual(["titulo"]);
  });

  it("rechaza tipo de peligro no permitido", () => {
    expect(campos(() => validarNuevoIncidente({ ...valido, tipo_peligro: "Radiactivo" }))).toEqual(["tipo_peligro"]);
  });

  it("rechaza gravedad no permitida", () => {
    expect(campos(() => validarNuevoIncidente({ ...valido, gravedad: "Extrema" }))).toEqual(["gravedad"]);
  });

  it("rechaza cuerpos que no son objeto", () => {
    expect(campos(() => validarNuevoIncidente(null))).toEqual(["body"]);
    expect(campos(() => validarNuevoIncidente([]))).toEqual(["body"]);
  });
});

describe("validarIdIncidente", () => {
  it("acepta un UUID", () => {
    expect(validarIdIncidente("00000000-0000-4000-8000-000000000001")).toBe("00000000-0000-4000-8000-000000000001");
  });

  it.each(["abc", "", "123", undefined, 5])("rechaza %s", (valor) => {
    expect(campos(() => validarIdIncidente(valor))).toEqual(["id"]);
  });
});
