"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ConsultaIncidente from "@/components/ConsultaIncidente";
import Navbar from "@/components/Navbar";
import ReportarIncidente from "@/components/ReportarIncidente";
import type { UsuarioApp } from "@/types/incidentes";
import { obtenerUsuarioSesion } from "@/utils/supabase";

/**
 * Pantalla del empleado. Solo orquesta componentes de presentación:
 * no contiene SQL, no accede a la tabla incidentes y no calcula prioridades.
 */
export default function DashboardEmpleadoPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioApp | null>(null);
  const [authCargada, setAuthCargada] = useState(false);
  const [ultimoId, setUltimoId] = useState<string | undefined>();
  const consultaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cargarSesion = async () => {
      setUsuario(await obtenerUsuarioSesion());
      setAuthCargada(true);
    };
    void cargarSesion();
  }, []);

  useEffect(() => {
    if (authCargada && (!usuario || usuario.rol !== "EMPLEADO")) {
      router.push("/");
    }
  }, [authCargada, router, usuario]);

  const irAConsulta = () => {
    const consulta = consultaRef.current;
    consulta?.scrollIntoView({ behavior: "smooth", block: "start" });
    requestAnimationFrame(() => consulta?.querySelector("input")?.focus({ preventScroll: true }));
  };

  return (
    <div className="min-h-screen bg-zinc-100">
      <Navbar rolActual="EMPLEADO" correo={usuario?.email ?? ""} />
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <ReportarIncidente
          onIncidenteCreado={(incidente) => setUltimoId(incidente.id)}
          onIrAConsulta={irAConsulta}
        />
        <div ref={consultaRef} className="scroll-mt-4">
          <ConsultaIncidente key={ultimoId ?? "sin-id"} idSugerido={ultimoId} />
        </div>
      </main>
    </div>
  );
}
