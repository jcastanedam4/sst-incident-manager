"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { obtenerUsuarioSesion, supabase } from "@/utils/supabase";
import {
  ESTADOS_INCIDENTE,
  GRAVEDADES,
  normalizarEstado,
  obtenerEstadosPersistencia,
  TIPOS_GTC45,
  TIPO_PELIGRO_SIN_CLASIFICAR,
  type AuditLog,
  type EstadoIncidente,
  type Gravedad,
  type Incidente,
  type Prioridad,
  type TipoPeligroRegistrado,
  type UsuarioApp,
} from "@/types/incidentes";
import { actualizarClasificacionIncidente, sugerirTipoRiesgo } from "@/utils/incidentesApi";
import { filtrarIncidentes, type FiltroPrioridad } from "@/utils/filtrosIncidentes";
import { calcularIndicadoresIncidentes } from "@/utils/indicadoresIncidentes";
import ExportButtons from "./ExportButtons";

const COLOR_ESTADO: Record<EstadoIncidente, string> = {
  Abierto: "bg-amber-100 text-amber-900",
  "En Proceso": "bg-blue-100 text-blue-900",
  Cerrado: "bg-emerald-100 text-emerald-900",
};

const COLOR_PRIORIDAD: Record<Prioridad, string> = {
  Alta: "border-red-200 bg-red-100 text-red-900",
  Media: "border-amber-200 bg-amber-100 text-amber-900",
  Baja: "border-emerald-200 bg-emerald-100 text-emerald-900",
};

const COLOR_INDICADOR_PRIORIDAD: Record<string, string> = {
  Alta: "border-red-200 bg-red-50 text-red-900",
  Media: "border-amber-200 bg-amber-50 text-amber-900",
  Baja: "border-emerald-200 bg-emerald-50 text-emerald-900",
  "Sin clasificar": "border-zinc-200 bg-zinc-50 text-zinc-700",
};

const INCIDENTES_POR_PAGINA = 10;

const tipoPeligroRegistrado = (valor: string): TipoPeligroRegistrado =>
  valor === TIPO_PELIGRO_SIN_CLASIFICAR
    ? TIPO_PELIGRO_SIN_CLASIFICAR
    : TIPOS_GTC45.find((tipo) => tipo === valor) ?? TIPO_PELIGRO_SIN_CLASIFICAR;

const gravedadRegistrada = (valor: unknown): Gravedad =>
  GRAVEDADES.find((gravedad) => gravedad === valor) ?? "Media";

export default function DashboardAdminPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioApp | null>(null);
  const [authCargada, setAuthCargada] = useState(false);
  const [incidentes, setIncidentes] = useState<Incidente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [incidenteSeleccionado, setIncidenteSeleccionado] = useState<Incidente | null>(null);
  const [tipoPeligroEditor, setTipoPeligroEditor] = useState<TipoPeligroRegistrado>(TIPO_PELIGRO_SIN_CLASIFICAR);
  const [gravedadEditor, setGravedadEditor] = useState<Gravedad>("Media");
  const [sugerenciaTipoAdmin, setSugerenciaTipoAdmin] = useState<string | null>(null);
  const [estadoSugerenciaAdmin, setEstadoSugerenciaAdmin] = useState<"inactiva" | "consultando" | "lista" | "error">("inactiva");
  const [filtroEstado, setFiltroEstado] = useState<"TODOS" | EstadoIncidente>("TODOS");
  const [filtroPrioridad, setFiltroPrioridad] = useState<FiltroPrioridad>("TODOS");
  const [prioridad, setPrioridad] = useState("Media");
  const [medidaCorrectiva, setMedidaCorrectiva] = useState("");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [paginaIncidentes, setPaginaIncidentes] = useState(1);
  const listaIncidentesRef = useRef<HTMLElement>(null);
  const sugerenciaAbortRef = useRef<AbortController | null>(null);
  const tipoPeligroEditadoRef = useRef(false);

  useEffect(() => () => sugerenciaAbortRef.current?.abort(), []);

  const cambiarPagina = (pagina: number) => {
    setPaginaIncidentes(pagina);
    listaIncidentesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cargarIncidentes = async () => {
    const { data, error: fetchError } = await supabase
      .from("incidentes")
      .select("id, user_id, titulo, descripcion, tipo_peligro, gravedad, prioridad_asignada, requiere_atencion_inmediata, estado, created_at, fecha_suceso, ubicacion, evidencias(url_storage, tipo_archivo, created_at)")
      .order("created_at", { ascending: false });

    let incidentesCrudos = data as unknown as Incidente[] | null;

    if (fetchError) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("incidentes")
        .select("id, user_id, titulo, descripcion, tipo_peligro, gravedad, prioridad_asignada, requiere_atencion_inmediata, estado, created_at, ubicacion")
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
    sugerenciaAbortRef.current?.abort();
    tipoPeligroEditadoRef.current = false;
    setIncidenteSeleccionado(incidente);
    setTipoPeligroEditor(tipoPeligroRegistrado(incidente.tipo_peligro));
    setGravedadEditor(gravedadRegistrada(incidente.gravedad));
    setSugerenciaTipoAdmin(null);
    setEstadoSugerenciaAdmin("consultando");
    setPrioridad("Media");
    setMedidaCorrectiva("");
    setError(null);

    const controlador = new AbortController();
    sugerenciaAbortRef.current = controlador;
    const resultadoSugerenciaPromise = sugerirTipoRiesgo(incidente.descripcion, controlador.signal);
    await cargarAuditLogs(incidente.id);
    const resultado = await resultadoSugerenciaPromise;

    if (controlador.signal.aborted) {
      return;
    }

    if (resultado.ok) {
      setSugerenciaTipoAdmin(resultado.data.tipo_peligro);
      setEstadoSugerenciaAdmin("lista");
      if (!tipoPeligroEditadoRef.current) {
        setTipoPeligroEditor(resultado.data.tipo_peligro);
      }
    } else {
      setEstadoSugerenciaAdmin("error");
    }
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

  const persistirClasificacion = async () => {
    if (!incidenteSeleccionado) {
      return false;
    }

    const clasificacionSinCambios =
      incidenteSeleccionado.tipo_peligro === tipoPeligroEditor &&
      incidenteSeleccionado.gravedad === gravedadEditor &&
      (tipoPeligroEditor === TIPO_PELIGRO_SIN_CLASIFICAR || incidenteSeleccionado.prioridad_asignada !== null);
    if (clasificacionSinCambios) {
      return true;
    }

    const respuesta = await actualizarClasificacionIncidente(incidenteSeleccionado.id, {
      tipo_peligro: tipoPeligroEditor,
      gravedad: gravedadEditor,
    });

    if (!respuesta.ok) {
      setError(`No se pudo guardar la clasificación: ${respuesta.mensaje}`);
      return false;
    }

    setIncidenteSeleccionado(respuesta.data);
    setIncidentes((actuales) =>
      actuales.map((incidente) => (incidente.id === respuesta.data.id ? { ...incidente, ...respuesta.data } : incidente))
    );
    await cargarAuditLogs(incidenteSeleccionado.id);
    return true;
  };

  const guardarClasificacion = async () => {
    if (!incidenteSeleccionado) {
      return;
    }

    setLoading(true);
    setError(null);
    const guardado = await persistirClasificacion();
    if (guardado) {
      setError(null);
    }
    setLoading(false);
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

    const clasificacionGuardada = await persistirClasificacion();
    if (!clasificacionGuardada) {
      setLoading(false);
      return;
    }

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

  const guardarYCerrar = async () => {
    if (!incidenteSeleccionado) {
      return;
    }

    setLoading(true);
    setError(null);
    const clasificacionGuardada = await persistirClasificacion();
    if (!clasificacionGuardada) {
      setLoading(false);
      return;
    }

    const actualizado = await actualizarEstado(incidenteSeleccionado.id, "Cerrado");
    if (actualizado) {
      sugerenciaAbortRef.current?.abort();
      setIncidenteSeleccionado(null);
    }
  };

  const incidentesFiltrados = useMemo(
    () => filtrarIncidentes(incidentes, filtroEstado, filtroPrioridad),
    [filtroEstado, filtroPrioridad, incidentes]
  );

  const totalPaginas = Math.max(1, Math.ceil(incidentesFiltrados.length / INCIDENTES_POR_PAGINA));
  const paginaVisible = Math.min(paginaIncidentes, totalPaginas);

  const incidentesPaginados = useMemo(() => {
    const indiceInicio = (paginaVisible - 1) * INCIDENTES_POR_PAGINA;
    return incidentesFiltrados.slice(indiceInicio, indiceInicio + INCIDENTES_POR_PAGINA);
  }, [incidentesFiltrados, paginaVisible]);

  const indicadores = useMemo(() => calcularIndicadoresIncidentes(incidentes), [incidentes]);

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
                <ExportButtons incidentes={incidentes} />
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

            <div className="mt-6 border-t border-zinc-100 pt-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-zinc-900">Prioridad asignada por el sistema</h3>
                  <p className="mt-1 text-xs text-zinc-500">Distribucion de los incidentes segun su nivel de riesgo.</p>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                  <span className="font-semibold">Atencion inmediata</span>
                  <span className="rounded-full bg-red-700 px-2 py-0.5 text-xs font-bold text-white">
                    {indicadores.atencionInmediata}
                  </span>
                  <span className="text-xs">{indicadores.porcentajeAtencionInmediata}%</span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {indicadores.porPrioridad.map(({ nombre, cantidad, porcentaje }) => (
                  <article
                    key={nombre}
                    className={`rounded-lg border p-3 ${COLOR_INDICADOR_PRIORIDAD[nombre]}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase">{nombre}</p>
                      <p className="text-xs font-medium">{porcentaje}%</p>
                    </div>
                    <p className="mt-2 text-2xl font-bold">{cantidad}</p>
                    <p className="text-xs opacity-75">incidentes</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="mt-6 border-t border-zinc-100 pt-5">
              <div className="mb-3">
                <h3 className="font-semibold text-zinc-900">Incidentes por tipo de peligro</h3>
                <p className="mt-1 text-xs text-zinc-500">Cantidad y proporcion sobre el total de reportes.</p>
              </div>
              {indicadores.porTipo.length === 0 ? (
                <p className="rounded-lg bg-zinc-50 px-3 py-4 text-sm text-zinc-500">
                  {loading
                    ? "Cargando indicadores..."
                    : error
                      ? "No se pudieron cargar los indicadores."
                      : "Aun no hay incidentes registrados."}
                </p>
              ) : (
                <div className="space-y-3">
                  {indicadores.porTipo.map(({ tipo, cantidad, porcentaje }) => (
                    <div key={tipo}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs text-zinc-600">
                        <span className="font-medium">{tipo}</span>
                        <span>{cantidad} reportes · {porcentaje}%</span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={`Incidentes de tipo ${tipo}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={porcentaje}
                        aria-valuetext={`${cantidad} reportes, ${porcentaje}% del total`}
                        className="h-2 overflow-hidden rounded-full bg-zinc-100"
                      >
                        <div
                          className="h-full rounded-full bg-blue-700 transition-[width]"
                          style={{ width: `${porcentaje}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section
            ref={listaIncidentesRef}
            className="scroll-mt-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-zinc-900">Gestion de incidentes</h2>
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label="Filtrar por estado"
                  value={filtroEstado}
                  onChange={(event) => {
                    setFiltroEstado(event.target.value as "TODOS" | EstadoIncidente);
                    setPaginaIncidentes(1);
                  }}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700"
                >
                  <option value="TODOS">Todos</option>
                  {ESTADOS_INCIDENTE.map((estado) => (
                    <option key={estado} value={estado}>
                      {estado}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filtrar por prioridad"
                  value={filtroPrioridad}
                  onChange={(event) => {
                    setFiltroPrioridad(event.target.value as FiltroPrioridad);
                    setPaginaIncidentes(1);
                  }}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700"
                >
                  <option value="TODOS">Todas las prioridades</option>
                  <option value="Alta">Prioridad Alta</option>
                  <option value="Media">Prioridad Media</option>
                  <option value="Baja">Prioridad Baja</option>
                  <option value="SIN_CLASIFICAR">Sin clasificar</option>
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
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {incidente.prioridad_asignada ? (
                        <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${COLOR_PRIORIDAD[incidente.prioridad_asignada]}`}>
                          Prioridad {incidente.prioridad_asignada}
                        </span>
                      ) : (
                        <span className="rounded-full border border-zinc-300 bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                          Sin clasificar
                        </span>
                      )}
                      {incidente.gravedad && (
                        <span className="text-xs text-zinc-600">Gravedad {incidente.gravedad}</span>
                      )}
                      {incidente.requiere_atencion_inmediata && (
                        <span className="rounded-full bg-red-700 px-2 py-1 text-xs font-semibold text-white">
                          Atención inmediata
                        </span>
                      )}
                    </div>
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
                        disabled={paginaVisible === 1}
                        onClick={() => cambiarPagina(Math.max(1, paginaVisible - 1))}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Anterior
                      </button>
                      <span className="rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700">
                        Pagina {paginaVisible} de {totalPaginas}
                      </span>
                      <button
                        type="button"
                        disabled={paginaVisible === totalPaginas}
                        onClick={() => cambiarPagina(Math.min(totalPaginas, paginaVisible + 1))}
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
                <p className="mt-1 text-sm text-blue-900">
                  Prioridad del sistema: {incidenteSeleccionado.prioridad_asignada ?? "Sin clasificar"}
                  {incidenteSeleccionado.gravedad ? ` · Gravedad ${incidenteSeleccionado.gravedad}` : ""}
                  {incidenteSeleccionado.requiere_atencion_inmediata ? " · Atención inmediata" : ""}
                </p>

                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="tipoPeligroAdmin" className="mb-1 block text-sm font-medium text-blue-900">
                        Tipo de peligro (GTC 45)
                      </label>
                      <select
                        id="tipoPeligroAdmin"
                        value={tipoPeligroEditor}
                        onChange={(event) => {
                          tipoPeligroEditadoRef.current = true;
                          setTipoPeligroEditor(tipoPeligroRegistrado(event.target.value));
                        }}
                        className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
                      >
                        <option value={TIPO_PELIGRO_SIN_CLASIFICAR}>Sin clasificar</option>
                        {TIPOS_GTC45.map((tipo) => (
                          <option key={tipo} value={tipo}>{tipo}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="gravedadAdmin" className="mb-1 block text-sm font-medium text-blue-900">
                        Gravedad
                      </label>
                      <select
                        id="gravedadAdmin"
                        value={gravedadEditor}
                        onChange={(event) => setGravedadEditor(gravedadRegistrada(event.target.value))}
                        className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
                      >
                        {GRAVEDADES.map((gravedad) => (
                          <option key={gravedad} value={gravedad}>{gravedad}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div aria-live="polite">
                    {estadoSugerenciaAdmin === "consultando" && (
                      <p role="status" className="text-sm text-blue-800">Consultando sugerencia de IA...</p>
                    )}
                    {estadoSugerenciaAdmin === "lista" && sugerenciaTipoAdmin && (
                      <p role="status" className="text-sm text-blue-800">
                        Sugerencia de IA: <strong>{sugerenciaTipoAdmin}</strong>. Puedes modificarla antes de guardar.
                      </p>
                    )}
                    {estadoSugerenciaAdmin === "error" && (
                      <p role="alert" className="text-sm text-amber-800">
                        No se pudo obtener la sugerencia. Puedes asignar el tipo manualmente.
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="prioridad" className="mb-1 block text-sm font-medium text-blue-900">
                      Prioridad de la medida correctiva
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

                  {error && (
                    <p role="alert" className="text-sm font-medium text-red-700">
                      {error}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void guardarClasificacion()}
                      className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-900 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Guardar clasificación
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void guardarRevision()}
                      className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Guardar revision
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void guardarYCerrar()}
                      className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
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
