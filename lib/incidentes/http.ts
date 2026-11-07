import { NextResponse } from "next/server";
import { ErrorNoAutorizado, ErrorNoEncontrado, ErrorPersistencia, ErrorValidacion } from "./errores";

type CuerpoError = {
  error: { codigo: string; mensaje: string; detalles?: unknown };
};

const cuerpoError = (codigo: string, mensaje: string, detalles?: unknown): CuerpoError => ({
  error: { codigo, mensaje, ...(detalles ? { detalles } : {}) },
});

/** Traduce errores controlados a respuestas HTTP. Los errores internos no exponen detalles técnicos. */
export function responderError(error: unknown): NextResponse {
  if (error instanceof ErrorValidacion) {
    return NextResponse.json(cuerpoError("VALIDACION", error.message, error.detalles), { status: 400 });
  }

  if (error instanceof ErrorNoAutorizado) {
    return NextResponse.json(cuerpoError("NO_AUTORIZADO", error.message), { status: 401 });
  }

  if (error instanceof ErrorNoEncontrado) {
    return NextResponse.json(cuerpoError("NO_ENCONTRADO", error.message), { status: 404 });
  }

  if (error instanceof ErrorPersistencia) {
    console.error("[api/v1/incidentes] error de persistencia:", error.causa ?? error.message);
  } else {
    console.error("[api/v1/incidentes] error inesperado:", error);
  }

  return NextResponse.json(cuerpoError("ERROR_INTERNO", "Error interno del servidor."), { status: 500 });
}

export async function leerJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ErrorValidacion([{ campo: "body", mensaje: "El cuerpo debe ser JSON válido." }]);
  }
}
