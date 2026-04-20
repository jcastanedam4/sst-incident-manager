"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase";

type Incidente = {
  id: string;
  titulo: string;
  descripcion: string;
  tipo_peligro: string;
  estado: string;
  created_at: string | null;
};

export default function ListaRevision() {
  const [incidentes, setIncidentes] = useState<Incidente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revisandoId, setRevisandoId] = useState<string | null>(null);
  const [medidaCorrectiva, setMedidaCorrectiva] = useState("");

  const cargarIncidentesPendientes = async () => {
    const { data, error: fetchError } = await supabase
      .from("incidentes")
      .select("id, titulo, descripcion, tipo_peligro, estado, created_at")
      .eq("estado", "pendiente")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(`No se pudieron cargar incidentes: ${fetchError.message}`);
      setLoading(false);
      return;
    }

    setError(null);
    setIncidentes((data ?? []) as Incidente[]);
    setLoading(false);
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void cargarIncidentesPendientes();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  const abrirFormularioRevision = (id: string) => {
    setRevisandoId(id);
    setMedidaCorrectiva("");
    setError(null);
  };

  const guardarRevision = async (incidenteId: string) => {
    if (!medidaCorrectiva.trim()) {
      setError("Debes escribir una medida correctiva.");
      return;
    }

    setLoading(true);
    setError(null);

    // ESCRITURA (INSERT): guardamos la medida correctiva relacionada al incidente.
    const { error: medidaError } = await supabase.from("medidas_correctivas").insert({
      incidente_id: incidenteId,
      descripcion_accion: medidaCorrectiva,
      responsable: "Especialista SST",
    });

    if (medidaError) {
      setError(`No se pudo guardar la medida correctiva: ${medidaError.message}`);
      setLoading(false);
      return;
    }

    // ACTUALIZACION (UPDATE): cambiamos estado del incidente a en_revision.
    const { error: updateError } = await supabase
      .from("incidentes")
      .update({ estado: "en_revision" })
      .eq("id", incidenteId);

    if (updateError) {
      setError(`No se pudo actualizar el estado: ${updateError.message}`);
      setLoading(false);
      return;
    }

    setRevisandoId(null);
    setMedidaCorrectiva("");
    await cargarIncidentesPendientes();
  };

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-zinc-900">Revision de incidentes (Administrador)</h2>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setError(null);
            void cargarIncidentesPendientes();
          }}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
        >
          Recargar
        </button>
      </div>

      {loading && <p className="mb-3 text-sm text-zinc-600">Cargando...</p>}
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {incidentes.length === 0 && !loading ? (
        <p className="text-sm text-zinc-600">No hay incidentes pendientes por revisar.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-700">
                <th className="px-2 py-2 font-semibold">ID</th>
                <th className="px-2 py-2 font-semibold">Titulo</th>
                <th className="px-2 py-2 font-semibold">Tipo</th>
                <th className="px-2 py-2 font-semibold">Accion</th>
              </tr>
            </thead>
            <tbody>
              {incidentes.map((incidente) => (
                <tr key={incidente.id} className="border-b border-zinc-100 align-top">
                  <td className="px-2 py-3 text-zinc-700">{incidente.id}</td>
                  <td className="px-2 py-3">
                    <p className="font-medium text-zinc-900">{incidente.titulo}</p>
                    <p className="mt-1 max-w-xl text-zinc-600">{incidente.descripcion}</p>
                  </td>
                  <td className="px-2 py-3 text-zinc-700">{incidente.tipo_peligro}</td>
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      onClick={() => abrirFormularioRevision(incidente.id)}
                      className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700"
                    >
                      Revisar
                    </button>

                    {revisandoId === incidente.id && (
                      <div className="mt-3 w-72 space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                        <label className="block text-xs font-semibold text-zinc-700">Medida correctiva</label>
                        <textarea
                          rows={3}
                          value={medidaCorrectiva}
                          onChange={(event) => setMedidaCorrectiva(event.target.value)}
                          className="w-full rounded-md border border-zinc-300 px-2 py-1 text-xs outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                          placeholder="Ejemplo: Limpiar area y colocar senalizacion preventiva."
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void guardarRevision(incidente.id)}
                            className="rounded-md bg-orange-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-orange-700"
                          >
                            Guardar revision
                          </button>
                          <button
                            type="button"
                            onClick={() => setRevisandoId(null)}
                            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-700 transition hover:bg-white"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
