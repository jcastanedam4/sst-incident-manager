"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/utils/supabase";
import { obtenerEstadosPersistencia } from "@/types/incidentes";

const TIPOS_GTC45 = [
  "Fisico",
  "Quimico",
  "Biologico",
  "Biomecanico",
  "Psicosocial",
  "Seguridad",
  "Fenomeno natural",
] as const;

type FormularioIncidenteProps = {
  onIncidenteCreado?: () => void;
};

export default function FormularioIncidente({ onIncidenteCreado }: FormularioIncidenteProps) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipoPeligro, setTipoPeligro] = useState<string>(TIPOS_GTC45[0]);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMensaje(null);
    setError(null);

    // ESCRITURA (INSERT): guardamos un incidente nuevo en la tabla incidentes.
    const [estadoPersistencia] = obtenerEstadosPersistencia("Abierto");
    const { error: insertError } = await supabase.from("incidentes").insert({
      titulo,
      descripcion,
      tipo_peligro: tipoPeligro,
      estado: estadoPersistencia,
      fecha_suceso: new Date().toISOString(),
    });

    if (insertError) {
      setError(`No se pudo guardar el incidente: ${insertError.message}`);
      setLoading(false);
      return;
    }

    setTitulo("");
    setDescripcion("");
    setTipoPeligro(TIPOS_GTC45[0]);
    setMensaje("Incidente enviado con estado Abierto.");
    setLoading(false);
    onIncidenteCreado?.();
  };

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-bold text-zinc-900">Reporte de incidente (Empleado)</h2>
      <p className="mb-4 text-sm text-zinc-600">Completa el formulario y envia el reporte para revision.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="titulo" className="mb-1 block text-sm font-medium text-zinc-700">
            Titulo
          </label>
          <input
            id="titulo"
            type="text"
            required
            value={titulo}
            onChange={(event) => setTitulo(event.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            placeholder="Ejemplo: Derrame en zona de bodega"
          />
        </div>

        <div>
          <label htmlFor="descripcion" className="mb-1 block text-sm font-medium text-zinc-700">
            Descripcion
          </label>
          <textarea
            id="descripcion"
            required
            rows={4}
            value={descripcion}
            onChange={(event) => setDescripcion(event.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            placeholder="Describe que ocurrio, donde y que riesgo observaste."
          />
        </div>

        <div>
          <label htmlFor="tipoPeligro" className="mb-1 block text-sm font-medium text-zinc-700">
            Tipo de peligro (GTC 45)
          </label>
          <select
            id="tipoPeligro"
            value={tipoPeligro}
            onChange={(event) => setTipoPeligro(event.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          >
            {TIPOS_GTC45.map((tipo) => (
              <option className="bg-white text-zinc-900" key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Enviando..." : "Enviar"}
        </button>
      </form>

      {mensaje && <p className="mt-3 text-sm text-emerald-700">{mensaje}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}
