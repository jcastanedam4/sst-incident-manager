"use client";

import { FormEvent, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { consultarIncidente, listarMisIncidentes, type IncidenteClasificadoApi } from "@/utils/incidentesApi";
import { obtenerUltimoIncidenteId } from "@/utils/ultimoIncidente";
import ClasificacionIncidente from "./ClasificacionIncidente";

type Props = { idSugerido?: string };

export default function ConsultaIncidente({ idSugerido }: Props) {
  const ultimoIdGuardado = useSyncExternalStore(
    () => () => {},
    obtenerUltimoIncidenteId,
    () => null
  );
  const [id, setId] = useState<string | undefined>(idSugerido);
  const idVisible = id ?? ultimoIdGuardado ?? "";
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incidente, setIncidente] = useState<IncidenteClasificadoApi | null>(null);
  const [historial, setHistorial] = useState<IncidenteClasificadoApi[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null);
  const consultandoRef = useRef(false);
  const incidenteRef = useRef<HTMLDivElement>(null);

  const cargarHistorial = useCallback(async () => {
    setCargandoHistorial(true);
    setErrorHistorial(null);

    try {
      const respuesta = await listarMisIncidentes();
      if (respuesta.ok) {
        setHistorial(respuesta.data);
      } else {
        setErrorHistorial(respuesta.mensaje);
      }
    } catch (error) {
      setErrorHistorial(error instanceof Error ? error.message : "No se pudo cargar el historial.");
    } finally {
      setCargandoHistorial(false);
    }
  }, []);

  useEffect(() => {
    let vigente = true;

    void listarMisIncidentes()
      .then((respuesta) => {
        if (!vigente) return;
        if (respuesta.ok) {
          setHistorial(respuesta.data);
        } else {
          setErrorHistorial(respuesta.mensaje);
        }
      })
      .catch((error: unknown) => {
        if (vigente) {
          setErrorHistorial(error instanceof Error ? error.message : "No se pudo cargar el historial.");
        }
      })
      .finally(() => {
        if (vigente) setCargandoHistorial(false);
      });

    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    if (incidente) {
      incidenteRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    }
  }, [incidente]);

  const consultar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (consultandoRef.current) return;

    consultandoRef.current = true;
    setCargando(true);
    setError(null);
    setIncidente(null);

    try {
      const respuesta = await consultarIncidente(idVisible);
      if (respuesta.ok) {
        setIncidente(respuesta.data);
      } else if (respuesta.tipo === "validacion") {
        setError(respuesta.detalles[0]?.mensaje ?? respuesta.mensaje);
      } else {
        setError(respuesta.mensaje);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo completar la consulta.");
    } finally {
      consultandoRef.current = false;
      setCargando(false);
    }
  };

  const seleccionarReporte = (reporte: IncidenteClasificadoApi) => {
    setId(reporte.id);
    setError(null);
    setIncidente(reporte);
  };

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-zinc-900">Consultar incidente</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Selecciona uno de tus reportes recientes o consulta por identificador si lo tienes.
      </p>

      <form onSubmit={consultar} className="mt-4 flex flex-col gap-2 sm:flex-row" noValidate>
        <input
          aria-label="Identificador del incidente (opcional)"
          value={idVisible}
          onChange={(e) => {
            setId(e.target.value);
            setIncidente(null);
            setError(null);
          }}
          placeholder="UUID del incidente (opcional)"
          style={{ color: "#111827", WebkitTextFillColor: "#111827", caretColor: "#111827" }}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
        />
        <button type="submit" disabled={cargando}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
          {cargando ? "Consultando..." : "Consultar"}
        </button>
      </form>

      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-6 border-t border-zinc-100 pt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-zinc-900">Tus últimos 5 reportes</h3>
            <p className="mt-1 text-xs text-zinc-500">Selecciona un reporte para ver su clasificación guardada.</p>
          </div>
          <button
            type="button"
            onClick={() => void cargarHistorial()}
            disabled={cargandoHistorial}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cargandoHistorial ? "Cargando..." : "Actualizar"}
          </button>
        </div>

        {errorHistorial && <p role="alert" className="mb-3 text-sm text-red-600">{errorHistorial}</p>}
        {cargandoHistorial && historial.length === 0 && (
          <p role="status" className="text-sm text-zinc-500">Cargando tus reportes...</p>
        )}
        {!cargandoHistorial && !errorHistorial && historial.length === 0 && (
          <p className="rounded-lg bg-zinc-50 px-3 py-4 text-sm text-zinc-500">
            Aún no tienes reportes registrados.
          </p>
        )}
        {historial.length > 0 && (
          <ul aria-label="Historial de los últimos 5 reportes" className="space-y-2">
            {historial.map((reporte) => (
              <li key={reporte.id}>
                <button
                  type="button"
                  aria-pressed={idVisible === reporte.id}
                  onClick={() => seleccionarReporte(reporte)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    idVisible === reporte.id
                      ? "border-blue-300 bg-blue-50"
                      : "border-zinc-200 bg-white hover:bg-zinc-50"
                  }`}
                >
                  <span className="flex flex-wrap items-start justify-between gap-2">
                    <span className="font-semibold text-zinc-900">{reporte.titulo}</span>
                    <span className="text-xs text-zinc-500">
                      {new Date(reporte.fecha_registro).toLocaleString("es-CO")}
                    </span>
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-700">{reporte.estado}</span>
                    <span className="rounded-full bg-blue-100 px-2 py-1 font-semibold text-blue-900">
                      Prioridad {reporte.prioridad_asignada}
                    </span>
                    {reporte.requiere_atencion_inmediata && (
                      <span className="rounded-full bg-red-700 px-2 py-1 font-semibold text-white">
                        Atención inmediata
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {incidente && (
        <div ref={incidenteRef}>
          <ClasificacionIncidente incidente={incidente} />
        </div>
      )}
    </section>
  );
}
