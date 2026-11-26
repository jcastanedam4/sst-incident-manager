import { useState } from "react";
import type { IncidenteClasificadoApi } from "@/utils/incidentesApi";

const COLOR_PRIORIDAD: Record<string, string> = {
  Alta: "bg-red-100 text-red-800 border-red-200",
  Media: "bg-amber-100 text-amber-800 border-amber-200",
  Baja: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

/** Solo muestra lo que calculó el backend; no contiene ninguna regla de priorización. */
export default function ClasificacionIncidente({ incidente }: { incidente: IncidenteClasificadoApi }) {
  const [idCopiado, setIdCopiado] = useState<string | null>(null);
  const [errorCopiar, setErrorCopiar] = useState(false);

  const copiarId = async () => {
    setErrorCopiar(false);
    try {
      await navigator.clipboard.writeText(incidente.id);
      setIdCopiado(incidente.id);
    } catch {
      setIdCopiado(null);
      setErrorCopiar(true);
    }
  };

  return (
    <dl aria-label="Clasificación del incidente" role="status" className="mt-4 space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800">
      <div>
        <dt className="font-semibold">Identificador</dt>
        <div className="flex flex-wrap items-center gap-2">
          <dd className="break-all font-mono text-xs">{incidente.id}</dd>
          <button
            type="button"
            onClick={() => void copiarId()}
            aria-label="Copiar identificador del incidente"
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            {idCopiado === incidente.id ? "ID copiado" : "Copiar ID"}
          </button>
        </div>
        {errorCopiar && (
          <p role="alert" className="mt-1 text-xs text-red-700">
            No se pudo copiar. Puedes seleccionar el identificador y copiarlo manualmente.
          </p>
        )}
      </div>
      <div>
        <dt className="font-semibold">Título</dt>
        <dd>{incidente.titulo}</dd>
      </div>
      <div>
        <dt className="font-semibold">Descripción</dt>
        <dd>{incidente.descripcion}</dd>
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <dt className="font-semibold">Tipo de peligro</dt>
          <dd>{incidente.tipo_peligro}</dd>
        </div>
        <div>
          <dt className="font-semibold">Gravedad</dt>
          <dd>{incidente.gravedad}</dd>
        </div>
        <div>
          <dt className="font-semibold">Estado</dt>
          <dd>{incidente.estado}</dd>
        </div>
        <div>
          <dt className="font-semibold">Fecha de registro</dt>
          <dd>{new Date(incidente.fecha_registro).toLocaleString("es-CO")}</dd>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <span
          className={`rounded-full border px-3 py-1 text-xs font-bold ${COLOR_PRIORIDAD[incidente.prioridad_asignada] ?? ""}`}
        >
          Prioridad {incidente.prioridad_asignada}
        </span>
        {incidente.requiere_atencion_inmediata ? (
          <span className="rounded-full border border-red-300 bg-red-600 px-3 py-1 text-xs font-bold text-white">
            Atención inmediata
          </span>
        ) : (
          <span className="text-xs text-zinc-600">No requiere atención inmediata</span>
        )}
      </div>
    </dl>
  );
}
