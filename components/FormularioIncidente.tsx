"use client";

import { FormEvent, useState } from "react";
import { supabase, obtenerUsuarioSesion } from "@/utils/supabase";
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

const convertirWebpAJpeg = async (archivo: File): Promise<File> => {
  const bitmap = await createImageBitmap(archivo);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return archivo;

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((resultado) => resolve(resultado), "image/jpeg", 0.92);
  });

  if (!blob) return archivo;

  const nombreBase = archivo.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${nombreBase}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
};

const normalizarArchivoParaSubida = async (archivo: File): Promise<File> => {
  if (archivo.type === "image/webp") {
    try {
      return await convertirWebpAJpeg(archivo);
    } catch {
      return archivo;
    }
  }

  return archivo;
};

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
  const [archivoAdjunto, setArchivoAdjunto] = useState<File | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMensaje(null);
    setError(null);

    // Obtener usuario autenticado para asociar email (necesario para RLS)
    const usuario = await obtenerUsuarioSesion();
    const [estadoPersistencia] = obtenerEstadosPersistencia("Abierto");

    // ESCRITURA (INSERT): guardamos un incidente nuevo en la tabla incidentes.
    const { error: insertError, data: insertData } = await supabase.from("incidentes").insert({
      titulo,
      descripcion,
      tipo_peligro: tipoPeligro,
      estado: estadoPersistencia,
      fecha_suceso: new Date().toISOString(),
      user_email: usuario?.email ?? null,
    }).select('id').single();

    if (insertError) {
      setError(`No se pudo guardar el incidente: ${insertError.message}`);
      setLoading(false);
      return;
    }

    const incidenteId = insertData?.id as string | undefined;

    // Si hay archivo, subimos a storage y registramos en tabla evidencias
    if (archivoAdjunto && incidenteId) {
      const archivoParaSubida = await normalizarArchivoParaSubida(archivoAdjunto);
      const nombreSeguro = archivoParaSubida.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
      const rutaArchivo = `incidentes/${incidenteId}/${Date.now()}_${nombreSeguro}`;

      const { data: subidaData, error: uploadError } = await supabase.storage
        .from("evidencias-incidentes")
        .upload(rutaArchivo, archivoParaSubida, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        setError(`Incidente creado, pero fallo la evidencia: ${uploadError.message}`);
        setLoading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from("evidencias-incidentes").getPublicUrl(subidaData.path);

      // Insert evidence record via server endpoint (uses service role to avoid RLS issues)
      try {
        const resp = await fetch("/api/evidencias", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            incidente_id: incidenteId,
            url_storage: publicUrlData.publicUrl,
            tipo_archivo: archivoParaSubida.type || "application/octet-stream",
          }),
        });

        const result = await resp.json();
        if (!resp.ok) {
          setError(`Incidente creado, pero fallo la evidencia: ${result.error ?? resp.statusText}`);
          setLoading(false);
          return;
        }

        setMensaje("Incidente enviado con evidencia multimedia.");
      } catch (e: any) {
        setError(`Incidente creado, pero fallo la evidencia: ${e?.message ?? String(e)}`);
        setLoading(false);
        return;
      }
    } else {
      setMensaje("Incidente enviado con estado Abierto.");
    }

    setTitulo("");
    setDescripcion("");
    setTipoPeligro(TIPOS_GTC45[0]);
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
