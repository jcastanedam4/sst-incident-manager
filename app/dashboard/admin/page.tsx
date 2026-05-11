"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { obtenerUsuarioSesion, supabase } from "@/utils/supabase";
import {
  ESTADOS_INCIDENTE,
  normalizarEstado,
  obtenerEstadosPersistencia,
  type AuditLog,
  type EstadoIncidente,
  type Incidente,
  type UsuarioApp,
} from "@/types/incidentes";
import { exportarIncidentesExcel, exportarIndicadoresPdf } from "@/utils/reportes";

const COLOR_ESTADO: Record<EstadoIncidente, string> = {
  Abierto: "bg-amber-100 text-amber-900",
  "En Proceso": "bg-blue-100 text-blue-900",
  Cerrado: "bg-emerald-100 text-emerald-900",
};

const INCIDENTES_POR_PAGINA = 10;

export default function DashboardAdminPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioApp | null>(null);
  const [authCargada, setAuthCargada] = useState(false);
  const [incidentes, setIncidentes] = useState<Incidente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [incidenteSeleccionado, setIncidenteSeleccionado] = useState<Incidente | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<"TODOS" | EstadoIncidente>("TODOS");
  const [prioridad, setPrioridad] = useState("Media");
  const [medidaCorrectiva, setMedidaCorrectiva] = useState("");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [paginaIncidentes, setPaginaIncidentes] = useState(1);

  const cargarIncidentes = async () => {
    const { data, error: fetchError } = await supabase
      .from("incidentes")
      .select("id, user_id, titulo, descripcion, tipo_peligro, estado, created_at, fecha_suceso, ubicacion, evidencias(url_storage, tipo_archivo, created_at)")
      .order("created_at", { ascending: false });

    let incidentesCrudos = data as unknown as Incidente[] | null;

    if (fetchError) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("incidentes")
        .select("id, user_id, titulo, descripcion, tipo_peligro, estado, created_at, ubicacion")
        .order("created_at", { ascending: false });

      if (fallbackError) {
        setError(`No se pudieron cargar incidentes: ${fallbackError.message}`);
        setLoading(false);
        return;
      }

      incidentesCrudos = (fallbackData ?? []) as Incidente[];
    }

    setError(null);
    const normalizados = (incidentesCrudos ?? []).map((incidente) => {
      const evidencias = incidente.evidencias ?? [];
      const evidenciaReciente = evidencias[0];

      return {
        ...incidente,
        estado: normalizarEstado(incidente.estado),
        ubicacion: incidente.ubicacion ?? null,
        evidencia_url: incidente.evidencia_url ?? evidenciaReciente?.url_storage ?? null,
      };
    });
    setIncidentes(normalizados);
    setLoading(false);
  };

  const cargarAuditLogs = async (incidenteId: string) => {
    setLoadingLogs(true);
    const { data, error: logsError } = await supabase
      .from("audit_logs")
      .select("id, record_id, changed_by, action, old_data, new_data, created_at")
      .eq("record_id", incidenteId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (logsError) {
      setAuditLogs([]);
      setLoadingLogs(false);
      return;
    }

    setAuditLogs((data ?? []) as AuditLog[]);
    setLoadingLogs(false);
  };

  useEffect(() => {
    const cargarSesion = async () => {
      const usuarioActual = await obtenerUsuarioSesion();
      setUsuario(usuarioActual);
      setAuthCargada(true);
    };

    void cargarSesion();
  }, []);

  useEffect(() => {
    if (!authCargada) {
      return;
    }

    if (!usuario) {
      router.push("/");
      return;
    }

    if (usuario.rol !== "ADMIN") {
      router.push("/");
      return;
    }

    const timeoutId = setTimeout(() => {
      void cargarIncidentes();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [authCargada, router, usuario]);

  const seleccionarIncidente = async (incidente: Incidente) => {
    setIncidenteSeleccionado(incidente);
    setPrioridad("Media");
    setMedidaCorrectiva("");
    setError(null);
    await cargarAuditLogs(incidente.id);
  };

  const actualizarEstado = async (incidenteId: string, estado: EstadoIncidente) => {
    setLoading(true);
    setError(null);

    const candidatos = obtenerEstadosPersistencia(estado);
    let updateError: Error | null = null;

    for (const estadoPersistencia of candidatos) {
      const { error } = await supabase
        .from("incidentes")
        .update({ estado: estadoPersistencia })
        .eq("id", incidenteId);

      if (!error) {
        updateError = null;
        break;
      }

      updateError = error;
    }

    if (updateError) {
      setError(
        `No se pudo actualizar el estado: ${updateError.message}. Valores probados: ${candidatos.join(", ")}`
      );
      setLoading(false);
      return false;
    }

    await cargarIncidentes();
    if (incidenteSeleccionado?.id === incidenteId) {
      await cargarAuditLogs(incidenteId);
    }

    return true;
  };

  const guardarRevision = async () => {
    if (!incidenteSeleccionado) {
      return;
    }

    if (!medidaCorrectiva.trim()) {
      setError("Debes escribir una medida correctiva.");
      return;
    }

    setLoading(true);
    setError(null);

    const descripcionMedida = `[Prioridad: ${prioridad}] ${medidaCorrectiva}`;

    // ESCRITURA (INSERT): inserta la medida correctiva relacionada al incidente.
    const { error: insertMedidaError } = await supabase.from("medidas_correctivas").insert({
      incidente_id: incidenteSeleccionado.id,
      descripcion_accion: descripcionMedida,
      responsable: usuario?.email ?? "Especialista SST",
    });

    if (insertMedidaError) {
      setError(`No se pudo guardar la medida correctiva: ${insertMedidaError.message}`);
      setLoading(false);
      return;
    }

    // ACTUALIZACION (UPDATE): cambia el estado del incidente a en_revision.
    const actualizado = await actualizarEstado(incidenteSeleccionado.id, "En Proceso");

    if (!actualizado) {
      return;
    }

    setIncidenteSeleccionado(null);
    setAuditLogs([]);
    setPrioridad("Media");
    setMedidaCorrectiva("");
    setLoading(false);
  };

  const incidentesFiltrados = useMemo(() => {
    if (filtroEstado === "TODOS") {
      return incidentes;
    }

    return incidentes.filter((incidente) => incidente.estado === filtroEstado);
  }, [filtroEstado, incidentes]);

  const totalPaginas = Math.max(1, Math.ceil(incidentesFiltrados.length / INCIDENTES_POR_PAGINA));

  const incidentesPaginados = useMemo(() => {
    const indiceInicio = (paginaIncidentes - 1) * INCIDENTES_POR_PAGINA;
    return incidentesFiltrados.slice(indiceInicio, indiceInicio + INCIDENTES_POR_PAGINA);
  }, [incidentesFiltrados, paginaIncidentes]);

  useEffect(() => {
    setPaginaIncidentes(1);
  }, [filtroEstado]);

  useEffect(() => {
    if (paginaIncidentes > totalPaginas) {
      setPaginaIncidentes(totalPaginas);
    }
  }, [paginaIncidentes, totalPaginas]);

  const indicadores = useMemo(() => {
    const total = incidentes.length;
    const abiertos = incidentes.filter((incidente) => incidente.estado === "Abierto").length;
    const enProceso = incidentes.filter((incidente) => incidente.estado === "En Proceso").length;
    const cerrados = incidentes.filter((incidente) => incidente.estado === "Cerrado").length;

    const porTipo = incidentes.reduce<Record<string, number>>((acc, incidente) => {
      acc[incidente.tipo_peligro] = (acc[incidente.tipo_peligro] ?? 0) + 1;
      return acc;
    }, {});

    return {
      total,
      abiertos,
      enProceso,
      cerrados,
      porTipo: Object.entries(porTipo).sort((a, b) => b[1] - a[1]),
    };
  }, [incidentes]);

  return (
    <div className="min-h-screen bg-zinc-100">
      <Navbar rolActual="ADMIN" correo={usuario?.email ?? ""} />

      <div className="flex min-h-[calc(100vh-73px)]">
        <aside className="hidden w-72 bg-blue-900 p-6 text-blue-50 lg:block">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">Panel Responsable SST</p>
          <h1 className="mt-2 text-2xl font-bold">Revision y priorizacion</h1>
          <p className="mt-3 text-sm text-blue-100">
            Esta vista representa al rol administrador. Aqui priorizas incidentes y registras medidas correctivas.
          </p>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-zinc-900">Indicadores de accidentalidad</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void exportarIndicadoresPdf(incidentes)}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                >
                  Exportar PDF
                </button>
                <button
                  type="button"
                  onClick={() => void exportarIncidentesExcel(incidentes)}
                  className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
                >
                  Exportar Excel
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs uppercase text-zinc-500">Total</p>
                <p className="mt-1 text-2xl font-bold text-zinc-900">{indicadores.total}</p>
              </article>
              <article className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs uppercase text-amber-700">Abiertos</p>
                <p className="mt-1 text-2xl font-bold text-amber-900">{indicadores.abiertos}</p>
              </article>
              <article className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs uppercase text-blue-700">En Proceso</p>
                <p className="mt-1 text-2xl font-bold text-blue-900">{indicadores.enProceso}</p>
              </article>
              <article className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs uppercase text-emerald-700">Cerrados</p>
                <p className="mt-1 text-2xl font-bold text-emerald-900">{indicadores.cerrados}</p>
              </article>
            </div>

            <div className="mt-4 space-y-2">
              {indicadores.porTipo.map(([tipo, cantidad]) => {
                const ancho = indicadores.total > 0 ? Math.max(8, Math.round((cantidad / indicadores.total) * 100)) : 0;
                return (
                  <div key={tipo}>
                    <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
                      <span>{tipo}</span>
                      <span>{cantidad}</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-100">
                      <div className="h-2 rounded-full bg-blue-700" style={{ width: `${ancho}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-zinc-900">Gestion de incidentes</h2>
              <div className="flex gap-2">
                <select
                  value={filtroEstado}
                  onChange={(event) => setFiltroEstado(event.target.value as "TODOS" | EstadoIncidente)}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700"
                >
                  <option value="TODOS">Todos</option>
                  {ESTADOS_INCIDENTE.map((estado) => (
                    <option key={estado} value={estado}>
                      {estado}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    setError(null);
                    void cargarIncidentes();
                  }}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                >
                  Recargar
                </button>
              </div>
            </div>

            {loading && <p className="text-sm text-zinc-600">Cargando...</p>}
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

            {!loading && incidentesFiltrados.length === 0 && (
              <p className="text-sm text-zinc-600">No hay incidentes para el filtro seleccionado.</p>
            )}

            {!loading && incidentesFiltrados.length > 0 && (
              <div className="space-y-3">
                {incidentesPaginados.map((incidente) => (
                  <article key={incidente.id} className="rounded-lg border border-zinc-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase text-zinc-500">Incidente #{incidente.id}</p>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${COLOR_ESTADO[incidente.estado as EstadoIncidente]}`}>
                        {incidente.estado}
                      </span>
                    </div>
                    <h3 className="mt-1 text-lg font-semibold text-zinc-900">{incidente.titulo}</h3>
                    <p className="mt-2 text-sm text-zinc-600">{incidente.descripcion}</p>
                    <p className="mt-2 text-xs font-medium text-zinc-500">Tipo de peligro: {incidente.tipo_peligro}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void seleccionarIncidente(incidente)}
                        className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
                      >
                        Revisar y ver auditoria
                      </button>
                      <button
                        type="button"
                        onClick={() => void actualizarEstado(incidente.id, "En Proceso")}
                        className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-50"
                      >
                        Marcar En Proceso
                      </button>
                      <button
                        type="button"
                        onClick={() => void actualizarEstado(incidente.id, "Cerrado")}
                        className="rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
                      >
                        Cerrar
                      </button>
                    </div>

                    {incidente.evidencia_url && (
                      <a
                        href={incidente.evidencia_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs font-semibold text-blue-700 hover:underline"
                      >
                        Ver evidencia
                      </a>
                    )}
                  </article>
                ))}

                {incidentesFiltrados.length > INCIDENTES_POR_PAGINA && (
                  <div className="flex items-center justify-between gap-3 pt-2 text-sm text-zinc-600">
                    <p>
                      Mostrando {Math.min(incidentesFiltrados.length, (paginaIncidentes - 1) * INCIDENTES_POR_PAGINA + 1)}-
                      {Math.min(paginaIncidentes * INCIDENTES_POR_PAGINA, incidentesFiltrados.length)} de {incidentesFiltrados.length}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={paginaIncidentes === 1}
                        onClick={() => setPaginaIncidentes((actual) => Math.max(1, actual - 1))}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Anterior
                      </button>
                      <span className="rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700">
                        Pagina {paginaIncidentes} de {totalPaginas}
                      </span>
                      <button
                        type="button"
                        disabled={paginaIncidentes === totalPaginas}
                        onClick={() => setPaginaIncidentes((actual) => Math.min(totalPaginas, actual + 1))}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {incidenteSeleccionado && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4">
              <section className="w-full max-w-xl rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-xl">
                <h2 className="text-lg font-bold text-blue-950">Revision del incidente</h2>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-blue-900">
                  #{incidenteSeleccionado.id}
                </p>
                <p className="mt-2 text-sm font-semibold text-blue-950">{incidenteSeleccionado.titulo}</p>

                <div className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="prioridad" className="mb-1 block text-sm font-medium text-blue-900">
                      Prioridad
                    </label>
                    <select
                      id="prioridad"
                      value={prioridad}
                      onChange={(event) => setPrioridad(event.target.value)}
                      className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
                    >
                      <option className="bg-white text-zinc-900" value="Alta">Alta</option>
                      <option className="bg-white text-zinc-900" value="Media">Media</option>
                      <option className="bg-white text-zinc-900" value="Baja">Baja</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="medida" className="mb-1 block text-sm font-medium text-blue-900">
                      Medida correctiva
                    </label>
                    <textarea
                      id="medida"
                      rows={4}
                      value={medidaCorrectiva}
                      onChange={(event) => setMedidaCorrectiva(event.target.value)}
                      className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
                      placeholder="Describe la accion correctiva que debe aplicarse."
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void guardarRevision()}
                      className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
                    >
                      Guardar revision
                    </button>
                    <button
                      type="button"
                      onClick={() => void actualizarEstado(incidenteSeleccionado.id, "Cerrado")}
                      className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
                    >
                      Guardar y cerrar
                    </button>
                    <button
                      type="button"
                      onClick={() => setIncidenteSeleccionado(null)}
                      className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-900 transition hover:bg-white"
                    >
                      Cancelar
                    </button>
                  </div>

                  <div className="rounded-lg border border-blue-200 bg-white p-3">
                    <h3 className="text-sm font-bold text-blue-900">Bitacora de auditoria</h3>
                    {loadingLogs && <p className="mt-2 text-xs text-zinc-600">Cargando historial...</p>}
                    {!loadingLogs && auditLogs.length === 0 && (
                      <p className="mt-2 text-xs text-zinc-600">
                        Sin registros visibles. Verifica que exista la tabla audit_logs y el trigger en Supabase.
                      </p>
                    )}
                    {!loadingLogs && auditLogs.length > 0 && (
                      <ul className="mt-2 space-y-2">
                        {auditLogs.map((log) => (
                          <li key={log.id} className="rounded-md border border-zinc-200 p-2 text-xs text-zinc-700">
                            <p>
                              <span className="font-semibold">{log.action}</span> - {new Date(log.created_at).toLocaleString()}
                            </p>
                            <p>Usuario: {log.changed_by ?? "No disponible"}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
