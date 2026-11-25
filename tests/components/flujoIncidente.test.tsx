import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import ReportarIncidente from "@/components/ReportarIncidente";
import ConsultaIncidente from "@/components/ConsultaIncidente";

const { crearIncidenteMock, consultarIncidenteMock } = vi.hoisted(() => ({
  crearIncidenteMock: vi.fn(),
  consultarIncidenteMock: vi.fn(),
}));

vi.mock("@/utils/incidentesApi", () => ({
  crearIncidente: crearIncidenteMock,
  consultarIncidente: consultarIncidenteMock,
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

const actualizarValor = async (elemento: HTMLInputElement | HTMLTextAreaElement, valor: string) => {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(elemento), "value");
  await act(async () => {
    descriptor?.set?.call(elemento, valor);
    elemento.dispatchEvent(new Event("input", { bubbles: true }));
    elemento.dispatchEvent(new Event("change", { bubbles: true }));
  });
};

const enviarFormulario = async (formulario: HTMLFormElement) => {
  await act(async () => {
    formulario.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
});

afterEach(async () => {
  await act(async () => root.unmount());
  contenedor.remove();
});

describe("resultados visibles en el flujo de reporte", () => {
  it("muestra la clasificación confirmada y conserva el ID de sesión", async () => {
    crearIncidenteMock.mockResolvedValue({ ok: true, data: incidente });
    await act(async () => root.render(<ReportarIncidente />));
    await enviarFormulario(contenedor.querySelector("form")!);

    expect(contenedor.textContent).toContain("Incidente registrado y clasificado por el sistema.");
    expect(contenedor.textContent).toContain(`Incidente ${incidente.id}: prioridad Alta`);
    expect(window.sessionStorage.getItem("sst-incident-manager:ultimo-incidente-id")).toBe(incidente.id);
  });

  it("muestra el rechazo y conserva los datos ingresados", async () => {
    crearIncidenteMock.mockResolvedValue({
      ok: false,
      tipo: "validacion",
      mensaje: "Revisa los datos.",
      detalles: [{ campo: "titulo", mensaje: "El título es obligatorio." }],
    });
    await act(async () => root.render(<ReportarIncidente />));
    const titulo = contenedor.querySelector<HTMLInputElement>("#titulo")!;
    await actualizarValor(titulo, "Reporte pendiente");
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
    const titulo = contenedor.querySelector<HTMLInputElement>("#titulo")!;
    await actualizarValor(titulo, "Reporte sin conexión");
    await enviarFormulario(contenedor.querySelector("form")!);

    expect(contenedor.querySelector('[role="alert"]')?.textContent).toContain("No se pudo confirmar el envío.");
    expect(titulo.value).toBe("Reporte sin conexión");
  });
});

describe("resultados visibles en la consulta", () => {
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
