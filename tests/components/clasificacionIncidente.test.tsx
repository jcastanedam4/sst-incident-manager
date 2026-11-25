import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ClasificacionIncidente from "@/components/ClasificacionIncidente";
import type { IncidenteClasificadoApi } from "@/utils/incidentesApi";

const incidente: IncidenteClasificadoApi = {
  id: "00000000-0000-4000-8000-000000000001",
  titulo: "Derrame",
  descripcion: "Sustancia en el piso",
  tipo_peligro: "Quimico",
  gravedad: "Alta",
  prioridad_asignada: "Alta",
  requiere_atencion_inmediata: true,
  estado: "Abierto",
  fecha_registro: "2026-11-14T10:00:00.000Z",
};

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
let writeText: ReturnType<typeof vi.fn>;
let root: Root;
let contenedor: HTMLDivElement;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
});

afterEach(async () => {
  await act(async () => root.unmount());
  contenedor.remove();
  if (clipboardDescriptor) {
    Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "clipboard");
  }
});

describe("ClasificacionIncidente", () => {
  it("copia el identificador y confirma la acción", async () => {
    await act(async () => root.render(<ClasificacionIncidente incidente={incidente} />));
    const boton = contenedor.querySelector<HTMLButtonElement>('[aria-label="Copiar identificador del incidente"]')!;

    await act(async () => {
      boton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(incidente.id);
    expect(boton.textContent).toBe("ID copiado");
  });

  it("informa cuando el portapapeles no está disponible", async () => {
    writeText.mockRejectedValue(new Error("Permiso denegado"));
    await act(async () => root.render(<ClasificacionIncidente incidente={incidente} />));
    const boton = contenedor.querySelector<HTMLButtonElement>('[aria-label="Copiar identificador del incidente"]')!;

    await act(async () => {
      boton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(contenedor.querySelector('[role="alert"]')?.textContent).toContain("No se pudo copiar");
  });

  it("muestra la prioridad pendiente cuando el incidente no tiene tipo clasificado", async () => {
    await act(async () => root.render(
      <ClasificacionIncidente
        incidente={{
          ...incidente,
          tipo_peligro: "Sin clasificar",
          prioridad_asignada: null,
          requiere_atencion_inmediata: null,
        }}
      />
    ));

    expect(contenedor.textContent).toContain("Prioridad pendiente de clasificación");
    expect(contenedor.textContent).toContain("Atención inmediata pendiente de clasificación");
  });
});
