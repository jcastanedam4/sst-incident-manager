"use client";

import { FormEvent, useRef, useState } from "react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { GRAVEDADES, TIPOS_GTC45 } from "@/types/incidentes";
import { esAplicacionNativa } from "@/utils/capacitor";
import { subirEvidencia } from "@/utils/evidencias";
import { crearIncidente, type IncidenteClasificadoApi } from "@/utils/incidentesApi";
import ClasificacionIncidente from "./ClasificacionIncidente";

type Props = {
  onIncidenteCreado?: (incidente: IncidenteClasificadoApi) => void;
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

export default function ReportarIncidente({ onIncidenteCreado }: Props) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipoPeligro, setTipoPeligro] = useState<string>(TIPOS_GTC45[0]);
  const [gravedad, setGravedad] = useState<string>("Media");
  const [archivoAdjunto, setArchivoAdjunto] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [erroresCampo, setErroresCampo] = useState<Record<string, string>>({});
  const [resultado, setResultado] = useState<IncidenteClasificadoApi | null>(null);
  const enviandoRef = useRef(false); // evita envíos simultáneos aunque React aún no haya re-renderizado
  const inputArchivoRef = useRef<HTMLInputElement | null>(null);

  const seleccionarFotoNativa = async () => {
    try {
      const foto = await Camera.getPhoto({ quality: 80, resultType: CameraResultType.DataUrl, source: CameraSource.Camera });
      if (!foto.dataUrl) {
        setAviso({ tipo: "negocio", texto: "No fue posible capturar la foto." });
        return;
      }
      const blob = await (await fetch(foto.dataUrl)).blob();
      setArchivoAdjunto(new File([blob], `evidencia_${Date.now()}.jpeg`, { type: blob.type || "image/jpeg" }));
    } catch {
      setAviso({ tipo: "negocio", texto: "No se pudo abrir la cámara del dispositivo." });
    }
  };

  const seleccionarFotoWeb = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setAviso({ tipo: "negocio", texto: "La cámara no está disponible en este navegador." });
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const video = document.createElement("video");
      video.autoplay = true;
      video.playsInline = true;
      video.srcObject = stream;
      await new Promise((res) => (video.onloadedmetadata = res));
      await new Promise((r) => setTimeout(r, 250));

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No es posible acceder al canvas");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      stream.getTracks().forEach((t) => t.stop());

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) {
        setAviso({ tipo: "negocio", texto: "No fue posible capturar la imagen." });
        return;
      }
      setArchivoAdjunto(new File([blob], `evidencia_${Date.now()}.jpg`, { type: "image/jpeg" }));
    } catch (e) {
      setAviso({ tipo: "negocio", texto: e instanceof Error ? e.message : "Error al acceder a la cámara" });
    }
  };

  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (enviandoRef.current) return;

    enviandoRef.current = true;
    setEnviando(true);
    setAviso(null);
    setErroresCampo({});
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

      if (archivoAdjunto) {
        const evidencia = await subirEvidencia(incidente.id, archivoAdjunto);
        if (!evidencia.ok) {
          setAviso({
            tipo: "advertencia",
            texto: `El incidente quedó registrado, pero la evidencia no pudo guardarse: ${evidencia.mensaje}`,
          });
        }
      }

      setTitulo("");
      setDescripcion("");
      setTipoPeligro(TIPOS_GTC45[0]);
      setGravedad("Media");
      setArchivoAdjunto(null);
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
    erroresCampo[campo] ? <p className="mt-1 text-xs text-red-600">{erroresCampo[campo]}</p> : null;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-zinc-900">Reporte de Incidente</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Registra la novedad SST. El sistema calculará la prioridad automáticamente.
      </p>

      <form onSubmit={enviar} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="titulo" className="mb-1 block text-sm font-medium text-zinc-700">Titulo</label>
          <input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} style={ESTILO_TEXTO}
            className={CLASES_CAMPO} placeholder="Ejemplo: Derrame en área de producción" />
          {errorCampo("titulo")}
        </div>

        <div>
          <label htmlFor="descripcion" className="mb-1 block text-sm font-medium text-zinc-700">Descripcion</label>
          <textarea id="descripcion" rows={4} value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
            style={ESTILO_TEXTO} className={CLASES_CAMPO} placeholder="Describe el incidente y el riesgo asociado." />
          {errorCampo("descripcion")}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="tipoPeligro" className="mb-1 block text-sm font-medium text-zinc-700">Tipo de peligro (GTC 45)</label>
            <select id="tipoPeligro" value={tipoPeligro} onChange={(e) => setTipoPeligro(e.target.value)}
              style={ESTILO_TEXTO} className={CLASES_CAMPO}>
              {TIPOS_GTC45.map((tipo) => (<option key={tipo} value={tipo}>{tipo}</option>))}
            </select>
            {errorCampo("tipo_peligro")}
          </div>
          <div>
            <label htmlFor="gravedad" className="mb-1 block text-sm font-medium text-zinc-700">Gravedad</label>
            <select id="gravedad" value={gravedad} onChange={(e) => setGravedad(e.target.value)}
              style={ESTILO_TEXTO} className={CLASES_CAMPO}>
              {GRAVEDADES.map((g) => (<option key={g} value={g}>{g}</option>))}
            </select>
            {errorCampo("gravedad")}
          </div>
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium text-zinc-700">Evidencia (opcional)</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => inputArchivoRef.current?.click()}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50">
              Adjuntar archivo
            </button>
            <button type="button" onClick={() => void (esAplicacionNativa() ? seleccionarFotoNativa() : seleccionarFotoWeb())}
              className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50">
              Tomar foto
            </button>
          </div>
          <input ref={inputArchivoRef} type="file" accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={(e) => setArchivoAdjunto(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
          {archivoAdjunto && <p className="mt-1 text-xs text-zinc-500">Archivo seleccionado: {archivoAdjunto.name}</p>}
        </div>

        <button type="submit" disabled={enviando}
          className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
          {enviando ? "Enviando..." : "Enviar reporte"}
        </button>
      </form>

      {aviso && (
        <div role="alert" className={`mt-4 rounded-lg border p-3 text-sm ${aviso.tipo === "advertencia"
          ? "border-amber-300 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-800"}`}>
          <p className="font-semibold">{TITULO_AVISO[aviso.tipo]}</p>
          <p>{aviso.texto}</p>
        </div>
      )}

      {resultado && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-emerald-700">Incidente registrado y clasificado por el sistema.</p>
          <ClasificacionIncidente incidente={resultado} />
        </div>
      )}
    </section>
  );
}
