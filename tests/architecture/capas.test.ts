// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const raiz = path.resolve(__dirname, "../..");
const leer = (rel: string) => fs.readFileSync(path.join(raiz, rel), "utf8");

const archivosUI = [
  "app/dashboard/empleado/page.tsx",
  "components/ReportarIncidente.tsx",
  "components/ConsultaIncidente.tsx",
  "components/ClasificacionIncidente.tsx",
];

describe("pruebas de arquitectura del corte vertical", () => {
  it("la interfaz no accede a la tabla incidentes ni contiene SQL", () => {
    for (const f of archivosUI) {
      const src = leer(f);
      expect(src, f).not.toMatch(/from\(\s*["'`]incidentes["'`]\s*\)/);
      expect(src, f).not.toMatch(/\b(select|insert into|update)\b[\s\S]{0,40}\bfrom\b/i);
    }
  });

  it("la interfaz no duplica la regla de prioridad", () => {
    for (const f of archivosUI) {
      expect(leer(f), f).not.toMatch(/PELIGROS_CRITICOS|evaluarRiesgo|prioridad_asignada\s*=/);
    }
  });

  it("los endpoints delegan al servicio y no tocan la base", () => {
    for (const f of ["app/api/v1/incidentes/route.ts", "app/api/v1/incidentes/[id]/route.ts"]) {
      const src = leer(f);
      expect(src).toContain("crearIncidentService");
      expect(src).not.toMatch(/\.from\(/);
    }
  });

  it("solo el repositorio consulta la tabla incidentes en la capa lib", () => {
    const dir = path.join(raiz, "lib/incidentes");
    for (const archivo of fs.readdirSync(dir)) {
      const src = fs.readFileSync(path.join(dir, archivo), "utf8");
      if (archivo !== "supabaseIncidentRepository.ts") {
        expect(src, archivo).not.toMatch(/\.from\(/);
      }
    }
  });

  it("el servicio no depende de HTTP ni de Supabase", () => {
    const src = leer("lib/incidentes/incidentService.ts");
    expect(src).not.toMatch(/next\/server|@supabase/);
  });
});
