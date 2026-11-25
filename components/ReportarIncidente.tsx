"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import Image from "next/image";
import { GRAVEDADES, TIPOS_GTC45 } from "@/types/incidentes";
import { esAplicacionNativa } from "@/utils/capacitor";
import { subirEvidencia } from "@/utils/evidencias";
import { crearIncidente, type IncidenteClasificadoApi } from "@/utils/incidentesApi";
import { guardarUltimoIncidenteId } from "@/utils/ultimoIncidente";
import ClasificacionIncidente from "./ClasificacionIncidente";

type Props = {
  onIncidenteCreado?: (incidente: IncidenteClasificadoApi) => void;
  onIrAConsulta?: () => void;
};

type Aviso = { tipo: "validacion" | "negocio" | "comunicacion" | "advertencia"; texto: string };

const CLASES_CAMPO =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";
const ESTILO_TEXTO = { color: "#111827", WebkitTextFillColor: "#111827", caretColor: "#111827" };

const TITULO_AVISO: Record<Aviso["tipo"], string> = {
  validacion: "Revisa los datos",
  negocio: "No se pudo registrar",
  comunicacion: "Problema de comunicación",
  advertencia: "Registrado con observaciones",
};

const mensajeErrorCamara = (error: unknown) =>
  error instanceof Error && ["NotAllowedError", "PermissionDeniedError"].includes(error.name)
    ? "No se concedió permiso para usar la cámara. Revisa los permisos del navegador o dispositivo."
    : "No se pudo abrir la cámara. Revisa los permisos e inténtalo de nuevo.";

export default function ReportarIncidente({ onIncidenteCreado, onIrAConsulta }: Props) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipoPeligro, setTipoPeligro] = useState("");
  const [gravedad, setGravedad] = useState("");
  const [archivoAdjunto, setArchivoAdjunto] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [subiendoEvidencia, setSubiendoEvidencia] = useState(false);
  const [capturandoFoto, setCapturandoFoto] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [erroresCampo, setErroresCampo] = useState<Record<string, string>>({});
  const [resultado, setResultado] = useState<IncidenteClasificadoApi | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const enviandoRef = useRef(false); // evita envíos simultáneos aunque React aún no haya re-renderizado
  const inputArchivoRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!archivoAdjunto?.type.startsWith("image/")) {
      setVistaPrevia(null);
      return;
    }

    const url = URL.createObjectURL(archivoAdjunto);
    setVistaPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [archivoAdjunto]);

  const seleccionarFotoNativa = async () => {
    try {
      const foto = await Camera.getPhoto({ quality: 80, resultType: CameraResultType.DataUrl, source: CameraSource.Camera });
      if (!foto.dataUrl) {
        setAviso({ tipo: "negocio", texto: "No fue posible capturar la foto." });
        return;
      }
      const blob = await (await fetch(foto.dataUrl)).blob();
      setArchivoAdjunto(new File([blob], `evidencia_${Date.now()}.jpeg`, { type: blob.type || "image/jpeg" }));
    } catch (error) {
      setAviso({ tipo: "negocio", texto: mensajeErrorCamara(error) });
    }
  };

  const seleccionarFotoWeb = async () => {
    let stream: MediaStream | null = null;
    let video: HTMLVideoElement | null = null;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setAviso({ tipo: "negocio", texto: "La cámara no está disponible en este navegador." });
        return;
      }
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const videoElement = document.createElement("video");
      video = videoElement;
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.srcObject = stream;
      await new Promise<void>((resolve) => {
        videoElement.onloadedmetadata = () => resolve();
      });
      await new Promise((r) => setTimeout(r, 250));

      const canvas = document.createElement("canvas");
      canvas.width = videoElement.videoWidth || 1280;
      canvas.height = videoElement.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No es posible acceder al canvas");
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) {
        setAviso({ tipo: "negocio", texto: "No fue posible capturar la imagen." });
        return;
      }
      setArchivoAdjunto(new File([blob], `evidencia_${Date.now()}.jpg`, { type: "image/jpeg" }));
    } catch (error) {
      setAviso({ tipo: "negocio", texto: mensajeErrorCamara(error) });
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      if (video) video.srcObject = null;
    }
  };

  const tomarFoto = async () => {
    if (enviandoRef.current || capturandoFoto) return;
    setAviso(null);
    setCapturandoFoto(true);
    try {
      await (esAplicacionNativa() ? seleccionarFotoNativa() : seleccionarFotoWeb());
    } finally {
      setCapturandoFoto(false);
    }
  };

  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (enviandoRef.current || capturandoFoto) return;

    setAviso(null);
    setErroresCampo({});

    const erroresSeleccion: Record<string, string> = {};
    if (!tipoPeligro) erroresSeleccion.tipo_peligro = "Selecciona un tipo de peligro.";
    if (!gravedad) erroresSeleccion.gravedad = "Selecciona la gravedad.";

    if (Object.keys(erroresSeleccion).length > 0) {
      setErroresCampo(erroresSeleccion);
      setAviso({ tipo: "validacion", texto: "Completa la clasificación del incidente antes de enviarlo." });
      return;
    }

    enviandoRef.current = true;
    setEnviando(true);
    setResultado(null);

    try {
      const respuesta = await crearIncidente({ titulo, descripcion, tipo_peligro: tipoPeligro, gravedad });

      if (!respuesta.ok) {
        // Los campos se conservan: solo se limpian tras confirmación del backend.
        if (respuesta.tipo === "validacion") {
          setErroresCampo(Object.fromEntries(respuesta.detalles.map((d) => [d.campo, d.mensaje])));
        }
        setAviso({ tipo: respuesta.tipo, texto: respuesta.mensaje });
        return;
      }

      const incidente = respuesta.data;
      setResultado(incidente);
      const advertencias: string[] = [];

      try {
        guardarUltimoIncidenteId(incidente.id);
      } catch {
        advertencias.push("No se pudo conservar el ID para consultarlo después de recargar la página.");
      }

      if (archivoAdjunto) {
        setSubiendoEvidencia(true);
        try {
          const evidencia = await subirEvidencia(incidente.id, archivoAdjunto);
          if (!evidencia.ok) {
            advertencias.push(`El incidente quedó registrado, pero la evidencia no pudo guardarse: ${evidencia.mensaje}`);
          }
        } catch (error) {
          const detalle = error instanceof Error ? error.message : "Error inesperado.";
          advertencias.push(`El incidente quedó registrado, pero la evidencia no pudo guardarse: ${detalle}`);
        } finally {
          setSubiendoEvidencia(false);
        }
      }

      if (advertencias.length > 0) {
        setAviso({ tipo: "advertencia", texto: advertencias.join(" ") });
      }

      setTitulo("");
      setDescripcion("");
      setTipoPeligro("");
      setGravedad("");
      setArchivoAdjunto(null);
      if (inputArchivoRef.current) inputArchivoRef.current.value = "";
      onIncidenteCreado?.(incidente);
    } catch (error) {
      setAviso({
        tipo: "comunicacion",
        texto: error instanceof Error ? error.message : "No se pudo completar el registro.",
      });
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  const errorCampo = (campo: string) =>
    erroresCampo[campo] ? (
      <p id={`error-${campo}`} className="mt-1 text-xs text-red-600">
        {erroresCampo[campo]}
      </p>
    ) : null;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-zinc-900">Reporte de Incidente</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Registra la novedad SST. El sistema calculará la prioridad automáticamente.
      </p>

      <form onSubmit={enviar} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="titulo" className="mb-1 block text-sm font-medium text-zinc-700">Titulo</label>
          <input
            id="titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            style={ESTILO_TEXTO}
            className={CLASES_CAMPO}
            placeholder="Ejemplo: Derrame en área de producción"
            required
            aria-invalid={Boolean(erroresCampo.titulo)}
            aria-describedby={erroresCampo.titulo ? "error-titulo" : undefined}
          />
          {errorCampo("titulo")}
        </div>

        <div>
          <label htmlFor="descripcion" className="mb-1 block text-sm font-medium text-zinc-700">Descripcion</label>
          <textarea
            id="descripcion"
            rows={4}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            style={ESTILO_TEXTO}
            className={CLASES_CAMPO}
            placeholder="Describe el incidente y el riesgo asociado."
            required
            aria-invalid={Boolean(erroresCampo.descripcion)}
            aria-describedby={erroresCampo.descripcion ? "error-descripcion" : undefined}
          />
          {errorCampo("descripcion")}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="tipoPeligro" className="mb-1 block text-sm font-medium text-zinc-700">Tipo de peligro (GTC 45)</label>
            <select
              id="tipoPeligro"
              value={tipoPeligro}
              onChange={(e) => setTipoPeligro(e.target.value)}
              style={ESTILO_TEXTO}
              className={CLASES_CAMPO}
              required
              aria-invalid={Boolean(erroresCampo.tipo_peligro)}
              aria-describedby={erroresCampo.tipo_peligro ? "error-tipo_peligro" : undefined}
            >
              <option value="" disabled>Selecciona el tipo de peligro</option>
              {TIPOS_GTC45.map((tipo) => (<option key={tipo} value={tipo}>{tipo}</option>))}
            </select>
            {errorCampo("tipo_peligro")}
          </div>
          <div>
            <label htmlFor="gravedad" className="mb-1 block text-sm font-medium text-zinc-700">Gravedad</label>
            <select
              id="gravedad"
              value={gravedad}
              onChange={(e) => setGravedad(e.target.value)}
              style={ESTILO_TEXTO}
              className={CLASES_CAMPO}
              required
              aria-invalid={Boolean(erroresCampo.gravedad)}
              aria-describedby={erroresCampo.gravedad ? "error-gravedad" : undefined}
            >
              <option value="" disabled>Selecciona la gravedad</option>
              {GRAVEDADES.map((g) => (<option key={g} value={g}>{g}</option>))}
            </select>
            {errorCampo("gravedad")}
          </div>
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium text-zinc-700">Evidencia (opcional)</span>
          <div className="flex gap-2">
            <button type="button" disabled={enviando || capturandoFoto} onClick={() => inputArchivoRef.current?.click()}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60">
              Adjuntar archivo
            </button>
            <button
              type="button"
              disabled={enviando || capturandoFoto}
              onClick={() => void tomarFoto()}
              className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {capturandoFoto ? "Abriendo cámara..." : "Tomar foto"}
            </button>
          </div>
          <input ref={inputArchivoRef} type="file" accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx"
            aria-label="Seleccionar evidencia"
            disabled={enviando || capturandoFoto}
            onChange={(e) => setArchivoAdjunto(e.target.files?.[0] ?? null)}
            style={{ display: "none" }}
          />
          {archivoAdjunto && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              {vistaPrevia && (
                <Image
                  width={64}
                  height={64}
                  src={vistaPrevia}
                  alt={`Vista previa de ${archivoAdjunto.name}`}
                  className="h-16 w-16 rounded-md object-cover"
                  unoptimized
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="break-all text-sm font-medium text-zinc-800">{archivoAdjunto.name}</p>
                <p className="text-xs text-zinc-500">{(archivoAdjunto.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                type="button"
                disabled={enviando}
                onClick={() => {
                  setArchivoAdjunto(null);
                  if (inputArchivoRef.current) inputArchivoRef.current.value = "";
                }}
                className="rounded-md px-2 py-1 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                Quitar evidencia
              </button>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={enviando || capturandoFoto}
          className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando ? subiendoEvidencia ? "Guardando evidencia..." : "Enviando reporte..." : "Enviar reporte"}
        </button>
        {subiendoEvidencia && (
          <p role="status" className="text-sm text-zinc-600">
            El incidente se registró. Estamos guardando la evidencia...
          </p>
        )}
      </form>

      {aviso && (
        <div role="alert" className={`mt-4 rounded-lg border p-3 text-sm ${aviso.tipo === "advertencia"
          ? "border-amber-300 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-800"}`}>
          <p className="font-semibold">{TITULO_AVISO[aviso.tipo]}</p>
          <p>{aviso.texto}</p>
        </div>
      )}

      {resultado && (
        <div role="status" className="mt-4">
          <p className="text-sm font-semibold text-emerald-700">Incidente registrado y clasificado por el sistema.</p>
          <ClasificacionIncidente incidente={resultado} />
          {onIrAConsulta && (
            <button
              type="button"
              onClick={onIrAConsulta}
              className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Consultar este incidente
            </button>
          )}
        </div>
      )}
    </section>
  );
}
