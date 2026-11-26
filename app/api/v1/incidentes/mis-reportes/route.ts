import { NextResponse } from "next/server";
import { autenticar, crearIncidentService } from "@/lib/incidentes/contexto";
import { responderError } from "@/lib/incidentes/http";

/** Devuelve los cinco reportes recientes del usuario autenticado. */
export async function GET(request: Request) {
  try {
    const { usuario, cliente } = await autenticar(request);
    const incidentes = await crearIncidentService(cliente).listarUltimosPorUsuario(usuario);

    return NextResponse.json({ data: incidentes }, { status: 200 });
  } catch (error) {
    return responderError(error);
  }
}
