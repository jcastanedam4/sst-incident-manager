import { NextResponse } from "next/server";
import { autenticar } from "@/lib/incidentes/contexto";
import { ErrorValidacion } from "@/lib/incidentes/errores";
import { leerJson, responderError } from "@/lib/incidentes/http";
import type { TipoPeligro } from "@/types/incidentes";

const TIPOS_POR_ETIQUETA: Record<string, TipoPeligro> = {
  Biologico: "Biologico",
  Biomecanico: "Biomecanico",
  "Condiciones de Seguridad": "Seguridad",
  "Fenomenos Naturales": "Fenomeno natural",
  Fisico: "Fisico",
  Psicosocial: "Psicosocial",
  Quimico: "Quimico",
};

const responderNoDisponible = () =>
  NextResponse.json(
    {
      error: {
        codigo: "IA_NO_DISPONIBLE",
        mensaje: "No se pudo obtener la sugerencia. El reporte puede enviarse como Sin clasificar para revisión.",
      },
    },
    { status: 503 }
  );

export async function POST(request: Request) {
  try {
    await autenticar(request);
    const cuerpo = await leerJson(request);

    if (!cuerpo || typeof cuerpo !== "object" || !("descripcion" in cuerpo)) {
      throw new ErrorValidacion([{ campo: "descripcion", mensaje: "La descripción es obligatoria." }]);
    }

    const descripcion = cuerpo.descripcion;
    if (typeof descripcion !== "string" || !descripcion.trim() || descripcion.length > 5000) {
      throw new ErrorValidacion([
        { campo: "descripcion", mensaje: "La descripción debe contener entre 1 y 5000 caracteres." },
      ]);
    }

    const servicioUrl = process.env.RISK_MODEL_API_URL ?? "http://127.0.0.1:8000/predict";
    let respuestaModelo: Response;
    try {
      respuestaModelo = await fetch(servicioUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: descripcion }),
        cache: "no-store",
        signal: request.signal,
      });
    } catch (error) {
      if (!request.signal.aborted) {
        console.error("[api/v1/sugerir-tipo-riesgo] servicio de inferencia no disponible:", error);
      }
      return responderNoDisponible();
    }

    if (!respuestaModelo.ok) {
      console.error("[api/v1/sugerir-tipo-riesgo] respuesta no exitosa del servicio:", respuestaModelo.status);
      return responderNoDisponible();
    }

    let resultado: unknown;
    try {
      resultado = await respuestaModelo.json();
    } catch {
      console.error("[api/v1/sugerir-tipo-riesgo] respuesta JSON inválida del servicio.");
      return responderNoDisponible();
    }

    if (!resultado || typeof resultado !== "object" || !("label" in resultado)) {
      console.error("[api/v1/sugerir-tipo-riesgo] respuesta sin etiqueta.");
      return responderNoDisponible();
    }

    const etiqueta = resultado.label;
    if (typeof etiqueta !== "string" || !Object.prototype.hasOwnProperty.call(TIPOS_POR_ETIQUETA, etiqueta)) {
      console.error("[api/v1/sugerir-tipo-riesgo] etiqueta no reconocida:", etiqueta);
      return responderNoDisponible();
    }

    return NextResponse.json({ data: { tipo_peligro: TIPOS_POR_ETIQUETA[etiqueta] } });
  } catch (error) {
    return responderError(error);
  }
}
