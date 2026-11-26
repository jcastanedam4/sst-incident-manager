import { GRAVEDADES, TIPOS_GTC45, type Gravedad, type TipoPeligro } from "@/types/incidentes";
import { ErrorValidacion, type DetalleValidacion } from "./errores";
import type { NuevoIncidenteEntrada } from "./modelo";

export const LIMITE_TITULO = 150;
export const LIMITE_DESCRIPCION = 2000;

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const esTexto = (valor: unknown): valor is string => typeof valor === "string";

/**
 * Valida la entrada de RF-01. Ignora cualquier campo extra (por ejemplo, una
 * prioridad enviada por el cliente): la prioridad solo la calcula el negocio.
 */
export function validarNuevoIncidente(entrada: unknown): NuevoIncidenteEntrada {
  const errores: DetalleValidacion[] = [];

  if (typeof entrada !== "object" || entrada === null || Array.isArray(entrada)) {
    throw new ErrorValidacion([{ campo: "body", mensaje: "El cuerpo debe ser un objeto JSON." }]);
  }

  const datos = entrada as Record<string, unknown>;

  const titulo = esTexto(datos.titulo) ? datos.titulo.trim() : "";
  if (!titulo) {
    errores.push({ campo: "titulo", mensaje: "El título es obligatorio." });
  } else if (titulo.length > LIMITE_TITULO) {
    errores.push({ campo: "titulo", mensaje: `El título no puede superar ${LIMITE_TITULO} caracteres.` });
  }

  const descripcion = esTexto(datos.descripcion) ? datos.descripcion.trim() : "";
  if (!descripcion) {
    errores.push({ campo: "descripcion", mensaje: "La descripción es obligatoria." });
  } else if (descripcion.length > LIMITE_DESCRIPCION) {
    errores.push({
      campo: "descripcion",
      mensaje: `La descripción no puede superar ${LIMITE_DESCRIPCION} caracteres.`,
    });
  }

  if (!esTexto(datos.tipo_peligro) || datos.tipo_peligro === "") {
    errores.push({ campo: "tipo_peligro", mensaje: "El tipo de peligro es obligatorio." });
  } else if (!(TIPOS_GTC45 as readonly string[]).includes(datos.tipo_peligro)) {
    errores.push({
      campo: "tipo_peligro",
      mensaje: `Tipo de peligro no permitido. Valores válidos: ${TIPOS_GTC45.join(", ")}.`,
    });
  }

  if (!esTexto(datos.gravedad) || datos.gravedad === "") {
    errores.push({ campo: "gravedad", mensaje: "La gravedad es obligatoria." });
  } else if (!(GRAVEDADES as readonly string[]).includes(datos.gravedad)) {
    errores.push({
      campo: "gravedad",
      mensaje: `Gravedad no permitida. Valores válidos: ${GRAVEDADES.join(", ")}.`,
    });
  }

  if (errores.length > 0) {
    throw new ErrorValidacion(errores);
  }

  return {
    titulo,
    descripcion,
    tipo_peligro: datos.tipo_peligro as TipoPeligro,
    gravedad: datos.gravedad as Gravedad,
  };
}

/** Valida el identificador de RF-02 (formato UUID). */
export function validarIdIncidente(id: unknown): string {
  if (!esTexto(id) || !REGEX_UUID.test(id.trim())) {
    throw new ErrorValidacion([{ campo: "id", mensaje: "El identificador debe ser un UUID válido." }]);
  }

  return id.trim().toLowerCase();
}
