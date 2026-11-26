import { NextResponse } from "next/server";
import { autenticar, crearIncidentService } from "@/lib/incidentes/contexto";
import { responderError } from "@/lib/incidentes/http";

type Parametros = { params: Promise<{ id: string }> };

/** RF-02: consultar un incidente clasificado por su identificador (solo lectura). */
export async function GET(request: Request, { params }: Parametros) {
  try {
    const { cliente } = await autenticar(request);
    const { id } = await params;
    const incidente = await crearIncidentService(cliente).consultarPorId(id);

    return NextResponse.json({ data: incidente }, { status: 200 });
  } catch (error) {
    return responderError(error);
  }
}
