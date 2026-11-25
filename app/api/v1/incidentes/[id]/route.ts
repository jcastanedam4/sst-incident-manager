import { NextResponse } from "next/server";
import { autenticar, autenticarAdministrador, crearIncidentService } from "@/lib/incidentes/contexto";
import { leerJson, responderError } from "@/lib/incidentes/http";

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

/** PATCH: solo admin puede actualizar tipo/gravedad; el servidor recalcula la prioridad. */
export async function PATCH(request: Request, { params }: Parametros) {
  try {
    const { cliente } = await autenticarAdministrador(request);
    const { id } = await params;
    const cuerpo = await leerJson(request);
    const incidente = await crearIncidentService(cliente).actualizarClasificacion(id, cuerpo);

    return NextResponse.json({ data: incidente }, { status: 200 });
  } catch (error) {
    return responderError(error);
  }
}
