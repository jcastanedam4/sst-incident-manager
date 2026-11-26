import type { Incidente } from "@/types/incidentes";

const obtenerPorcentaje = (cantidad: number, total: number) =>
  total === 0 ? 0 : Math.round((cantidad / total) * 100);

export const calcularIndicadoresIncidentes = (incidentes: Incidente[]) => {
  const conteos = incidentes.reduce(
    (resultado, incidente) => {
      resultado.total += 1;

      if (incidente.estado === "Abierto") resultado.abiertos += 1;
      if (incidente.estado === "En Proceso") resultado.enProceso += 1;
      if (incidente.estado === "Cerrado") resultado.cerrados += 1;

      if (incidente.requiere_atencion_inmediata) resultado.atencionInmediata += 1;

      switch (incidente.prioridad_asignada) {
        case "Alta":
          resultado.alta += 1;
          break;
        case "Media":
          resultado.media += 1;
          break;
        case "Baja":
          resultado.baja += 1;
          break;
        default:
          resultado.sinClasificar += 1;
      }

      resultado.porTipo[incidente.tipo_peligro] =
        (resultado.porTipo[incidente.tipo_peligro] ?? 0) + 1;

      return resultado;
    },
    {
      total: 0,
      abiertos: 0,
      enProceso: 0,
      cerrados: 0,
      atencionInmediata: 0,
      alta: 0,
      media: 0,
      baja: 0,
      sinClasificar: 0,
      porTipo: {} as Record<string, number>,
    }
  );

  const porPrioridad = [
    { nombre: "Alta", cantidad: conteos.alta },
    { nombre: "Media", cantidad: conteos.media },
    { nombre: "Baja", cantidad: conteos.baja },
    { nombre: "Sin clasificar", cantidad: conteos.sinClasificar },
  ].map((prioridad) => ({
    ...prioridad,
    porcentaje: obtenerPorcentaje(prioridad.cantidad, conteos.total),
  }));

  const porTipo = Object.entries(conteos.porTipo)
    .map(([tipo, cantidad]) => ({
      tipo,
      cantidad,
      porcentaje: obtenerPorcentaje(cantidad, conteos.total),
    }))
    .sort((a, b) => b.cantidad - a.cantidad);

  return {
    ...conteos,
    porPrioridad,
    porTipo,
    porcentajeAtencionInmediata: obtenerPorcentaje(conteos.atencionInmediata, conteos.total),
  };
};
