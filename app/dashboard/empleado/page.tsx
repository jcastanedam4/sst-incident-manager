"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { supabase } from "@/utils/supabase";
import { TIPOS_GTC45, type UsuarioSimulado } from "@/types/incidentes";

export default function DashboardEmpleadoPage() {
  const router = useRouter();
  const [usuario] = useState<UsuarioSimulado | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const usuarioGuardado = localStorage.getItem("sst_user");
    if (!usuarioGuardado) {
      return null;
    }

    try {
      return JSON.parse(usuarioGuardado) as UsuarioSimulado;
    } catch {
      return null;
    }
  });
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipoPeligro, setTipoPeligro] = useState<string>(TIPOS_GTC45[0]);
  const [archivoAdjunto, setArchivoAdjunto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!usuario || usuario.rol !== "EMPLEADO") {
      router.push("/");
    }
  }, [router, usuario]);

  const enviarIncidente = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMensaje(null);
    setError(null);

    const { data: incidenteCreado, error: insertError } = await supabase
      .from("incidentes")
      .insert({
        titulo,
        descripcion,
        tipo_peligro: tipoPeligro,
        estado: "Abierto",
        fecha_suceso: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      setError(`No se pudo guardar el incidente: ${insertError.message}`);
      setLoading(false);
      return;
    }

    let mensajeResultado = "Incidente enviado en estado Abierto.";

    if (archivoAdjunto && incidenteCreado?.id) {
      const nombreSeguro = archivoAdjunto.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
      const rutaArchivo = `incidentes/${incidenteCreado.id}/${Date.now()}_${nombreSeguro}`;

      const { data: subidaData, error: uploadError } = await supabase.storage
        .from("evidencias-incidentes")
        .upload(rutaArchivo, archivoAdjunto, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        setError(`Incidente creado, pero fallo la evidencia: ${uploadError.message}`);
        setLoading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from("evidencias-incidentes").getPublicUrl(subidaData.path);

      const { error: updateEvidenciaError } = await supabase
        .from("incidentes")
        .update({ evidencia_url: publicUrlData.publicUrl })
        .eq("id", incidenteCreado.id);

      if (updateEvidenciaError) {
        mensajeResultado =
          "Incidente y evidencia creados, pero no se pudo guardar el enlace en la tabla incidentes.";
      } else {
        mensajeResultado = "Incidente enviado con evidencia multimedia.";
      }
    }

    setTitulo("");
    setDescripcion("");
    setTipoPeligro(TIPOS_GTC45[0]);
    setArchivoAdjunto(null);
    setMensaje(mensajeResultado);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-100">
      <Navbar rolActual="EMPLEADO" correo={usuario?.email ?? "empleado@test.com"} />

      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-zinc-900">Reporte de Incidente</h1>
          <p className="mt-1 text-sm text-zinc-600">Interfaz de trabajador para registrar novedades SST.</p>

          <form onSubmit={enviarIncidente} className="mt-6 space-y-4">
            <div>
              <label htmlFor="titulo" className="mb-1 block text-sm font-medium text-zinc-700">
                Titulo
              </label>
              <input
                id="titulo"
                required
                value={titulo}
                onChange={(event) => setTitulo(event.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                placeholder="Ejemplo: Piso humedo en pasillo principal"
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
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                placeholder="Describe el incidente y el riesgo asociado."
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
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              >
                {TIPOS_GTC45.map((tipo) => (
                  <option className="bg-white text-zinc-900" key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="adjunto" className="mb-1 block text-sm font-medium text-zinc-700">
                Adjuntar evidencia (foto o archivo)
              </label>
              <input
                id="adjunto"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => setArchivoAdjunto(event.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
              />
              {archivoAdjunto && (
                <p className="mt-1 text-xs text-zinc-500">Archivo seleccionado: {archivoAdjunto.name}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Enviando..." : "Enviar reporte"}
            </button>
          </form>

          {mensaje && <p className="mt-4 text-sm text-emerald-700">{mensaje}</p>}
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </section>
      </main>
    </div>
  );
}
