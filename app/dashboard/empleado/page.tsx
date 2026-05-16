"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import Navbar from "@/components/Navbar";
import { obtenerUsuarioSesion, supabase } from "@/utils/supabase";
import { esAplicacionNativa } from "@/utils/capacitor";

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
import { TIPOS_GTC45, obtenerEstadosPersistencia, type UsuarioApp } from "@/types/incidentes";

export default function DashboardEmpleadoPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioApp | null>(null);
  const [authCargada, setAuthCargada] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipoPeligro, setTipoPeligro] = useState<string>(TIPOS_GTC45[0]);
  const [archivoAdjunto, setArchivoAdjunto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const seleccionarFotoNativa = async () => {
    try {
      const foto = await Camera.getPhoto({
        quality: 80,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });

      if (!foto.dataUrl) {
        setError("No fue posible capturar la foto.");
        return;
      }

      const respuesta = await fetch(foto.dataUrl);
      const blob = await respuesta.blob();
      const archivo = new File([blob], `evidencia_${Date.now()}.jpeg`, {
        type: blob.type || "image/jpeg",
      });

      setArchivoAdjunto(archivo);
      setError(null);
    } catch {
      setError("No se pudo abrir la camara del dispositivo.");
    }
  };

  const seleccionarFotoWeb = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("La cámara no está disponible en este navegador.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const video = document.createElement("video");
      video.autoplay = true;
      video.playsInline = true;
      video.srcObject = stream;

      await new Promise((res) => (video.onloadedmetadata = res));
      // esperar un frame para que la cámara ajuste
      await new Promise((r) => setTimeout(r, 250));

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No es posible acceder al canvas");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // detener tracks
      stream.getTracks().forEach((t) => t.stop());

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) {
        setError("No fue posible capturar la imagen.");
        return;
      }

      const archivo = new File([blob], `evidencia_${Date.now()}.jpg`, { type: "image/jpeg" });
      setArchivoAdjunto(archivo);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Error al acceder a la cámara");
    }
  };

  useEffect(() => {
    const cargarSesion = async () => {
      const usuarioActual = await obtenerUsuarioSesion();
      setUsuario(usuarioActual);
      setAuthCargada(true);
    };

    void cargarSesion();
  }, []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!authCargada) {
      return;
    }

    if (!usuario) {
      router.push("/");
      return;
    }

    if (usuario.rol !== "EMPLEADO") {
      router.push("/");
    }
  }, [authCargada, router, usuario]);

  const enviarIncidente = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMensaje(null);
    setError(null);

    let incidenteCreado: { id: string } | null = null;
    let insertError: Error | null = null;
    const candidatosEstado = obtenerEstadosPersistencia("Abierto");

    for (const estadoPersistencia of candidatosEstado) {
      const { data, error } = await supabase
        .from("incidentes")
        .insert({
          titulo,
          descripcion,
          tipo_peligro: tipoPeligro,
          estado: estadoPersistencia,
          fecha_suceso: new Date().toISOString(),
          user_email: usuario?.email ?? null,
        })
        .select("id")
        .single();

      if (!error) {
        incidenteCreado = data as { id: string };
        insertError = null;
        break;
      }

      insertError = error;
    }

    if (insertError) {
      setError(
        `No se pudo guardar el incidente: ${insertError.message}. Valores probados para estado: ${candidatosEstado.join(", ")}`
      );
      setLoading(false);
      return;
    }

    let mensajeResultado = "Incidente enviado en estado Abierto.";

    if (archivoAdjunto && incidenteCreado?.id) {
        const archivoParaSubida = await normalizarArchivoParaSubida(archivoAdjunto);
        const nombreSeguro = archivoParaSubida.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
      const rutaArchivo = `incidentes/${incidenteCreado.id}/${Date.now()}_${nombreSeguro}`;

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

      // Registrar evidencia vía endpoint servidor para evitar RLS en cliente
      try {
        const resp = await fetch("/api/evidencias", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            incidente_id: incidenteCreado.id,
            url_storage: publicUrlData.publicUrl,
            tipo_archivo: archivoParaSubida.type || "application/octet-stream",
          }),
        });

        const json = await resp.json();
        if (!resp.ok) {
          mensajeResultado = "Incidente creado, pero fallo la evidencia: " + (json.error ?? resp.statusText);
        } else {
          mensajeResultado = "Incidente enviado con evidencia multimedia.";
        }
      } catch (e: any) {
        mensajeResultado = "Incidente creado, pero fallo la evidencia: " + (e?.message ?? String(e));
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
      <Navbar rolActual="EMPLEADO" correo={usuario?.email ?? ""} />

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
                style={{ color: "#111827", WebkitTextFillColor: "#111827", caretColor: "#111827" }}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
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
                style={{ color: "#111827", WebkitTextFillColor: "#111827", caretColor: "#111827" }}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
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
                style={{ color: "#111827", WebkitTextFillColor: "#111827", caretColor: "#111827" }}
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
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-900 bg-white hover:bg-zinc-50"
                >
                  Adjuntar archivo
                </button>

                <button
                  type="button"
                  onClick={() => void (esAplicacionNativa() ? seleccionarFotoNativa() : seleccionarFotoWeb())}
                  className="inline-flex items-center rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-800 bg-white hover:bg-blue-50"
                >
                  Tomar foto
                </button>
              </div>

              <input
                id="adjunto"
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                onChange={(event) => setArchivoAdjunto(event.target.files?.[0] ?? null)}
                style={{ display: "none" }}
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
