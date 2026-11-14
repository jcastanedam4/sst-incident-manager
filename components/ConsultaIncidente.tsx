"use client";

import { FormEvent, useRef, useState } from "react";
import { consultarIncidente, type IncidenteClasificadoApi } from "@/utils/incidentesApi";
import ClasificacionIncidente from "./ClasificacionIncidente";

type Props = { idSugerido?: string };

export default function ConsultaIncidente({ idSugerido }: Props) {
  const [id, setId] = useState(idSugerido ?? "");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incidente, setIncidente] = useState<IncidenteClasificadoApi | null>(null);
  const consultandoRef = useRef(false);

  const consultar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (consultandoRef.current) return;

    consultandoRef.current = true;
    setCargando(true);
    setError(null);
    setIncidente(null);

    try {
      const respuesta = await consultarIncidente(id);
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

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-zinc-900">Consultar incidente</h2>
      <p className="mt-1 text-sm text-zinc-600">Ingresa el identificador para ver su clasificación guardada.</p>

      <form onSubmit={consultar} className="mt-4 flex flex-col gap-2 sm:flex-row" noValidate>
        <input
          aria-label="Identificador del incidente"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="UUID del incidente"
          style={{ color: "#111827", WebkitTextFillColor: "#111827", caretColor: "#111827" }}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
        />
        <button type="submit" disabled={cargando}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
          {cargando ? "Consultando..." : "Consultar"}
        </button>
      </form>

      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      {incidente && <ClasificacionIncidente incidente={incidente} />}
    </section>
  );
}
