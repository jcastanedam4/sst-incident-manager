import { NextResponse } from "next/server";
import { autenticar, crearIncidentService } from "@/lib/incidentes/contexto";
import { leerJson, responderError } from "@/lib/incidentes/http";

/** RF-01: registrar y clasificar un incidente. */
export async function POST(request: Request) {
  try {
    const { usuario, cliente } = await autenticar(request);
    const cuerpo = await leerJson(request);
    const incidente = await crearIncidentService(cliente).registrar(cuerpo, usuario);

    return NextResponse.json(
      { data: incidente },
      { status: 201, headers: { Location: `/api/v1/incidentes/${incidente.id}` } }
    );
  } catch (error) {
    return responderError(error);
  }
}
