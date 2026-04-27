"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";

type NavbarProps = {
  rolActual: "ADMIN" | "EMPLEADO";
  correo: string;
};

export default function Navbar({ rolActual, correo }: NavbarProps) {
  const router = useRouter();
  const rolVisible = rolActual === "ADMIN" ? "Encargado SST" : "Empleado";

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <header className="w-full border-b border-zinc-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">SST Incident Manager</p>
          <p className="text-sm text-zinc-700">
            Rol actual: <span className="font-bold text-zinc-900">{rolVisible}</span>
          </p>
          <p className="text-xs text-zinc-500">{correo}</p>
        </div>

        <button
          type="button"
          onClick={() => void cerrarSesion()}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
        >
          Cerrar sesion
        </button>
      </div>
    </header>
  );
}
