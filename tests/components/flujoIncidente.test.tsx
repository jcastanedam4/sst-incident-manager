import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReportarIncidente from "@/components/ReportarIncidente";
import ConsultaIncidente from "@/components/ConsultaIncidente";

const { crearIncidenteMock, consultarIncidenteMock, listarMisIncidentesMock, sugerirTipoRiesgoMock } = vi.hoisted(() => ({
  crearIncidenteMock: vi.fn(),
  consultarIncidenteMock: vi.fn(),
  listarMisIncidentesMock: vi.fn(),
  sugerirTipoRiesgoMock: vi.fn(),
}));

vi.mock("@/utils/incidentesApi", () => ({
  crearIncidente: crearIncidenteMock,
  consultarIncidente: consultarIncidenteMock,
  listarMisIncidentes: listarMisIncidentesMock,
  sugerirTipoRiesgo: sugerirTipoRiesgoMock,
}));

vi.mock("@/utils/evidencias", () => ({ subirEvidencia: vi.fn() }));
vi.mock("@/utils/capacitor", () => ({ esAplicacionNativa: () => false }));
vi.mock("@capacitor/camera", () => ({
  Camera: { getPhoto: vi.fn() },
  CameraResultType: { DataUrl: "dataUrl" },
  CameraSource: { Camera: "camera" },
}));
vi.mock("@/components/ClasificacionIncidente", () => ({
  default: ({ incidente }: { incidente: { id: string; prioridad_asignada: string } }) => (
    <div>Incidente {incidente.id}: prioridad {incidente.prioridad_asignada}</div>
  ),
}));

const incidente = {
  id: "00000000-0000-4000-8000-000000000001",
  titulo: "Derrame",
  descripcion: "Sustancia en el piso",
  tipo_peligro: "Quimico" as const,
  gravedad: "Alta" as const,
  prioridad_asignada: "Alta" as const,
  requiere_atencion_inmediata: true,
  estado: "Abierto",
  fecha_registro: "2026-11-14T10:00:00.000Z",
};

let root: Root;
let contenedor: HTMLDivElement;
const mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");

const actualizarValor = async (elemento: HTMLInputElement | HTMLTextAreaElement, valor: string) => {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(elemento), "value");
  await act(async () => {
    descriptor?.set?.call(elemento, valor);
    elemento.dispatchEvent(new Event("input", { bubbles: true }));
    elemento.dispatchEvent(new Event("change", { bubbles: true }));
  });
};

const actualizarSeleccion = async (elemento: HTMLSelectElement, valor: string) => {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(elemento), "value");
  await act(async () => {
    descriptor?.set?.call(elemento, valor);
    elemento.dispatchEvent(new Event("change", { bubbles: true }));
  });
};

const completarClasificacion = async () => {
  sugerirTipoRiesgoMock.mockResolvedValue({
    ok: true,
    data: { tipo_peligro: "Quimico" },
  });
  vi.useFakeTimers();
  await actualizarValor(
    contenedor.querySelector<HTMLTextAreaElement>("#descripcion")!,
    "Sustancia química derramada en el piso del área de trabajo."
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
  vi.useRealTimers();
  await actualizarSeleccion(contenedor.querySelector<HTMLSelectElement>("#gravedad")!, "Alta");
};

const actualizarTituloYEsperarClasificacion = async (valor: string) => {
  vi.useFakeTimers();
  await actualizarValor(contenedor.querySelector<HTMLInputElement>("#titulo")!, valor);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
  vi.useRealTimers();
};

const enviarFormulario = async (formulario: HTMLFormElement) => {
  await act(async () => {
    formulario.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  listarMisIncidentesMock.mockResolvedValue({ ok: true, data: [] });
  window.sessionStorage.clear();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
});

afterEach(async () => {
  await act(async () => root.unmount());
  contenedor.remove();
  if (mediaDevicesDescriptor) {
    Object.defineProperty(navigator, "mediaDevices", mediaDevicesDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "mediaDevices");
  }
});

describe("resultados visibles en el flujo de reporte", () => {
  it("aplica automáticamente la sugerencia después de una pausa y mantiene el tipo bloqueado", async () => {
    vi.useFakeTimers();
    sugerirTipoRiesgoMock.mockResolvedValue({
      ok: true,
      data: { tipo_peligro: "Seguridad" },
    });

    try {
      await act(async () => root.render(<ReportarIncidente />));
      const descripcion = contenedor.querySelector<HTMLTextAreaElement>("#descripcion")!;
      await actualizarValor(descripcion, "El trabajador se resbaló en una escalera.");
      await actualizarValor(descripcion, "El trabajador se resbaló en una escalera mojada.");

      expect(sugerirTipoRiesgoMock).not.toHaveBeenCalled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });

      expect(sugerirTipoRiesgoMock).toHaveBeenCalledOnce();
      expect(sugerirTipoRiesgoMock).toHaveBeenCalledWith(
        "El trabajador se resbaló en una escalera mojada.",
        expect.any(AbortSignal)
      );
      const tipoPeligro = contenedor.querySelector<HTMLInputElement>("#tipoPeligro")!;
      expect(tipoPeligro.value).toBe("Condiciones de Seguridad");
      expect(tipoPeligro.readOnly).toBe(true);
      expect(contenedor.textContent).toContain("Clasificación automática lista: Condiciones de Seguridad");
    } finally {
      vi.useRealTimers();
    }
  });

  it("clasifica un reporte corto al editar título y descripción", async () => {
    vi.useFakeTimers();
    sugerirTipoRiesgoMock.mockResolvedValue({
      ok: true,
      data: { tipo_peligro: "Seguridad" },
    });

    try {
      await act(async () => root.render(<ReportarIncidente />));
      await actualizarValor(contenedor.querySelector<HTMLInputElement>("#titulo")!, "piso mojado");
      await actualizarValor(contenedor.querySelector<HTMLTextAreaElement>("#descripcion")!, "piso mojado");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });

      expect(sugerirTipoRiesgoMock).toHaveBeenCalledWith(
        "piso mojado\npiso mojado",
        expect.any(AbortSignal)
      );
      expect(contenedor.querySelector<HTMLInputElement>("#tipoPeligro")?.value).toBe(
        "Condiciones de Seguridad"
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("permite el tipo pendiente, pero exige gravedad antes de enviar", async () => {
    await act(async () => root.render(<ReportarIncidente />));

    expect(contenedor.querySelector<HTMLInputElement>("#tipoPeligro")?.value).toBe("Sin clasificar");
    expect(contenedor.querySelector<HTMLSelectElement>("#gravedad")?.value).toBe("");
    await enviarFormulario(contenedor.querySelector("form")!);

    expect(crearIncidenteMock).not.toHaveBeenCalled();
    expect(contenedor.textContent).toContain("Selecciona la gravedad.");
  });

  it("envía Sin clasificar y avisa cuando falla la IA", async () => {
    vi.useFakeTimers();
    sugerirTipoRiesgoMock.mockResolvedValue({
      ok: false,
      tipo: "negocio",
      status: 503,
      mensaje: "No disponible",
    });
    crearIncidenteMock.mockResolvedValue({
      ok: true,
      data: {
        ...incidente,
        tipo_peligro: "Sin clasificar",
        prioridad_asignada: null,
        requiere_atencion_inmediata: null,
      },
    });

    try {
      await act(async () => root.render(<ReportarIncidente />));
      await actualizarValor(
        contenedor.querySelector<HTMLTextAreaElement>("#descripcion")!,
        "No se pudo identificar la categoría del riesgo."
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });
      vi.useRealTimers();
      await actualizarSeleccion(contenedor.querySelector<HTMLSelectElement>("#gravedad")!, "Media");
      await enviarFormulario(contenedor.querySelector("form")!);

      expect(crearIncidenteMock).toHaveBeenCalledWith(
        expect.objectContaining({ tipo_peligro: "Sin clasificar", gravedad: "Media" })
      );
      expect(contenedor.textContent).toContain("El reporte quedó sin tipo de peligro");
      expect(contenedor.textContent).toContain("pendiente de clasificación");
    } finally {
      vi.useRealTimers();
    }
  });

  it("muestra la clasificación confirmada, conserva el ID y permite ir a consultarlo", async () => {
    const irAConsulta = vi.fn();
    crearIncidenteMock.mockResolvedValue({ ok: true, data: incidente });
    await act(async () => root.render(<ReportarIncidente onIrAConsulta={irAConsulta} />));
    await completarClasificacion();
    await enviarFormulario(contenedor.querySelector("form")!);

    expect(contenedor.textContent).toContain("Incidente registrado y clasificado por el sistema.");
    expect(contenedor.textContent).toContain(`Incidente ${incidente.id}: prioridad Alta`);
    expect(window.sessionStorage.getItem("sst-incident-manager:ultimo-incidente-id")).toBe(incidente.id);

    const botonConsulta = [...contenedor.querySelectorAll("button")].find(
      (boton) => boton.textContent === "Consultar este incidente"
    )!;
    await act(async () => botonConsulta.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(irAConsulta).toHaveBeenCalledOnce();
  });

  it("permite quitar una evidencia seleccionada", async () => {
    await act(async () => root.render(<ReportarIncidente />));
    const inputArchivo = contenedor.querySelector<HTMLInputElement>('input[type="file"]')!;
    const archivo = new File(["contenido"], "evidencia.pdf", { type: "application/pdf" });

    await act(async () => {
      Object.defineProperty(inputArchivo, "files", { configurable: true, value: [archivo] });
      inputArchivo.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(contenedor.textContent).toContain("evidencia.pdf");
    const quitar = [...contenedor.querySelectorAll("button")].find(
      (boton) => boton.textContent === "Quitar evidencia"
    )!;
    await act(async () => quitar.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(contenedor.textContent).not.toContain("evidencia.pdf");
    expect(inputArchivo.value).toBe("");
  });

  it("explica cuando la cámara no tiene permiso", async () => {
    const errorPermiso = Object.assign(new Error("denied"), { name: "NotAllowedError" });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(errorPermiso) },
    });
    await act(async () => root.render(<ReportarIncidente />));
    const botonCamara = [...contenedor.querySelectorAll("button")].find(
      (boton) => boton.textContent === "Tomar foto"
    )!;

    await act(async () => {
      botonCamara.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(contenedor.querySelector('[role="alert"]')?.textContent).toContain("No se concedió permiso");
  });

  it("muestra el rechazo y conserva los datos ingresados", async () => {
    crearIncidenteMock.mockResolvedValue({
      ok: false,
      tipo: "validacion",
      mensaje: "Revisa los datos.",
      detalles: [{ campo: "titulo", mensaje: "El título es obligatorio." }],
    });
    await act(async () => root.render(<ReportarIncidente />));
    await completarClasificacion();
    const titulo = contenedor.querySelector<HTMLInputElement>("#titulo")!;
    await actualizarTituloYEsperarClasificacion("Reporte pendiente");
    await enviarFormulario(contenedor.querySelector("form")!);

    expect(contenedor.querySelector('[role="alert"]')?.textContent).toContain("Revisa los datos.");
    expect(contenedor.textContent).toContain("El título es obligatorio.");
    expect(titulo.value).toBe("Reporte pendiente");
  });

  it("muestra la desconexión sin borrar los campos", async () => {
    crearIncidenteMock.mockResolvedValue({
      ok: false,
      tipo: "comunicacion",
      mensaje: "No se pudo confirmar el envío.",
    });
    await act(async () => root.render(<ReportarIncidente />));
    await completarClasificacion();
    const titulo = contenedor.querySelector<HTMLInputElement>("#titulo")!;
    await actualizarTituloYEsperarClasificacion("Reporte sin conexión");
    await enviarFormulario(contenedor.querySelector("form")!);

    expect(contenedor.querySelector('[role="alert"]')?.textContent).toContain("No se pudo confirmar el envío.");
    expect(titulo.value).toBe("Reporte sin conexión");
  });
});

describe("resultados visibles en la consulta", () => {
  it("muestra los reportes recientes del usuario y permite seleccionar uno", async () => {
    const reporteReciente = { ...incidente, id: "00000000-0000-4000-8000-000000000002", titulo: "Caída" };
    listarMisIncidentesMock.mockResolvedValue({ ok: true, data: [reporteReciente] });

    await act(async () => root.render(<ConsultaIncidente />));

    expect(contenedor.textContent).toContain("Tus últimos 5 reportes");
    const botonReporte = [...contenedor.querySelectorAll("button")].find(
      (boton) => boton.textContent?.includes("Caída")
    )!;
    await act(async () => botonReporte.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(contenedor.querySelector<HTMLInputElement>("input")?.value).toBe(reporteReciente.id);
    expect(contenedor.textContent).toContain(`Incidente ${reporteReciente.id}: prioridad Alta`);
    expect(consultarIncidenteMock).not.toHaveBeenCalled();
  });

  it("muestra errores al cargar el historial sin ocultar la consulta manual", async () => {
    listarMisIncidentesMock.mockResolvedValue({
      ok: false,
      tipo: "negocio",
      status: 401,
      mensaje: "Tu sesión expiró.",
    });

    await act(async () => root.render(<ConsultaIncidente />));

    expect(contenedor.querySelector('[role="alert"]')?.textContent).toContain("Tu sesión expiró.");
    expect(contenedor.querySelector('input[aria-label="Identificador del incidente (opcional)"]')).not.toBeNull();
  });

  it("precarga el ID tras recargar y muestra la clasificación consultada", async () => {
    window.sessionStorage.setItem("sst-incident-manager:ultimo-incidente-id", incidente.id);
    consultarIncidenteMock.mockResolvedValue({ ok: true, data: incidente });
    await act(async () => root.render(<ConsultaIncidente />));
    const id = contenedor.querySelector<HTMLInputElement>("input")!;

    expect(id.value).toBe(incidente.id);
    await enviarFormulario(contenedor.querySelector("form")!);

    expect(contenedor.textContent).toContain(`Incidente ${incidente.id}: prioridad Alta`);
    expect(consultarIncidenteMock).toHaveBeenCalledWith(incidente.id);
  });

  it("muestra ausencia del incidente con el error de negocio de la API", async () => {
    consultarIncidenteMock.mockResolvedValue({
      ok: false,
      tipo: "negocio",
      status: 404,
      mensaje: "El incidente solicitado no existe.",
    });
    await act(async () => root.render(<ConsultaIncidente idSugerido={incidente.id} />));
    await enviarFormulario(contenedor.querySelector("form")!);

    expect(contenedor.querySelector('[role="alert"]')?.textContent).toContain("El incidente solicitado no existe.");
  });
});
