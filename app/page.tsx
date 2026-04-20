"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type UsuarioSimulado = {
  email: string;
  rol: "EMPLEADO" | "ADMIN";
};

type CredencialSimulada = {
  email: string;
  password: string;
  rol: "EMPLEADO" | "ADMIN";
  redirectTo: "/dashboard/empleado" | "/dashboard/admin";
  origen: "INVITADO" | "REGISTRO" | "ADMIN";
};

const STORAGE_USUARIOS_REGISTRADOS = "sst_registered_users";

const USUARIOS_QUEMADOS = [
  {
    email: "invitado@sst.com",
    password: "Invitado123",
    rol: "EMPLEADO" as const,
    redirectTo: "/dashboard/empleado",
    origen: "INVITADO" as const,
  },
  {
    email: "encargado.sst@empresa.com",
    password: "E1234",
    rol: "ADMIN" as const,
    redirectTo: "/dashboard/admin",
    origen: "ADMIN" as const,
  },
] satisfies CredencialSimulada[];

export default function Home() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [modoRegistro, setModoRegistro] = useState(false);
  const [correoRegistro, setCorreoRegistro] = useState("");
  const [contrasenaRegistro, setContrasenaRegistro] = useState("");
  const [confirmarContrasenaRegistro, setConfirmarContrasenaRegistro] = useState("");

  const obtenerUsuariosRegistrados = (): CredencialSimulada[] => {
    if (typeof window === "undefined") {
      return [];
    }

    const crudo = localStorage.getItem(STORAGE_USUARIOS_REGISTRADOS);
    if (!crudo) {
      return [];
    }

    try {
      const parseado = JSON.parse(crudo) as Array<{ email: string; password: string }>;
      return parseado.map((u) => ({
        email: u.email,
        password: u.password,
        rol: "EMPLEADO",
        redirectTo: "/dashboard/empleado",
        origen: "REGISTRO",
      }));
    } catch {
      return [];
    }
  };

  useEffect(() => {
    const usuarioGuardado = localStorage.getItem("sst_user");
    if (!usuarioGuardado) {
      return;
    }

    try {
      const usuario = JSON.parse(usuarioGuardado) as UsuarioSimulado;

      if (usuario.rol === "ADMIN") {
        router.push("/dashboard/admin");
        return;
      }

      router.push("/dashboard/empleado");
    } catch {
      localStorage.removeItem("sst_user");
    }
  }, [router]);

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const correoLimpio = correo.trim().toLowerCase();
    const credencialesDisponibles = [...USUARIOS_QUEMADOS, ...obtenerUsuariosRegistrados()];
    if (!correoLimpio || !contrasena) {
      alert("Credenciales incorrectas");
      return;
    }

    const usuarioValido = credencialesDisponibles.find(
      (usuario) => usuario.email === correoLimpio && usuario.password === contrasena
    );

    if (!usuarioValido) {
      alert("Credenciales incorrectas");
      return;
    }

    const usuarioSesion: UsuarioSimulado = {
      email: usuarioValido.email,
      rol: usuarioValido.rol,
    };

    localStorage.setItem("sst_user", JSON.stringify(usuarioSesion));

    router.push(usuarioValido.redirectTo);
  };

  const handleRegistro = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const usuariosRegistrados = obtenerUsuariosRegistrados();
    const credencialesDisponibles = [...USUARIOS_QUEMADOS, ...usuariosRegistrados];

    const correoLimpio = correoRegistro.trim().toLowerCase();
    if (!correoLimpio || !contrasenaRegistro) {
      alert("Completa correo y contrasena.");
      return;
    }

    if (contrasenaRegistro.length < 6) {
      alert("La contrasena debe tener al menos 6 caracteres.");
      return;
    }

    if (contrasenaRegistro !== confirmarContrasenaRegistro) {
      alert("Las contrasenas no coinciden.");
      return;
    }

    const existe = credencialesDisponibles.some((usuario) => usuario.email === correoLimpio);
    if (existe) {
      alert("Ese correo ya esta registrado.");
      return;
    }

    const nuevosRegistros = [
      ...usuariosRegistrados.map((u) => ({ email: u.email, password: u.password })),
      { email: correoLimpio, password: contrasenaRegistro },
    ];

    localStorage.setItem(STORAGE_USUARIOS_REGISTRADOS, JSON.stringify(nuevosRegistros));

    setCorreoRegistro("");
    setContrasenaRegistro("");
    setConfirmarContrasenaRegistro("");
    setModoRegistro(false);
    setCorreo(correoLimpio);
    setContrasena(contrasenaRegistro);
    alert("Cuenta de empleado creada. Ahora puedes iniciar sesion.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-10">
      <main className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Ingreso Simulado SST</p>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Iniciar sesion</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Admin: Encargado SST. Empleados: cuenta invitado o cuenta registrada.
        </p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-700">
              Correo electronico
            </label>
            <input
              id="email"
              type="email"
              required
              value={correo}
              onChange={(event) => setCorreo(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
              placeholder="ejemplo@empresa.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-zinc-700">
              Contrasena
            </label>
            <input
              id="password"
              type="password"
              required
              value={contrasena}
              onChange={(event) => setContrasena(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-200"
              placeholder="********"
            />
          </div>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-900"
          >
            Ingresar
          </button>
        </form>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setCorreo("invitado@sst.com");
              setContrasena("Invitado123");
            }}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            Usar cuenta invitado
          </button>
          <button
            type="button"
            onClick={() => setModoRegistro((actual) => !actual)}
            className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-800 transition hover:bg-blue-50"
          >
            {modoRegistro ? "Ocultar registro" : "Registrarse como empleado"}
          </button>
        </div>

        {modoRegistro && (
          <form onSubmit={handleRegistro} className="mt-4 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Registro Empleado</p>
            <input
              type="email"
              required
              value={correoRegistro}
              onChange={(event) => setCorreoRegistro(event.target.value)}
              placeholder="correo@empresa.com"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
            />
            <input
              type="password"
              required
              value={contrasenaRegistro}
              onChange={(event) => setContrasenaRegistro(event.target.value)}
              placeholder="Contrasena (min 6)"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
            />
            <input
              type="password"
              required
              value={confirmarContrasenaRegistro}
              onChange={(event) => setConfirmarContrasenaRegistro(event.target.value)}
              placeholder="Confirmar contrasena"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
            />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
            >
              Crear cuenta empleado
            </button>
          </form>
        )}

        <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
          <p>Usuarios de prueba:</p>
          <p>- invitado@sst.com / Invitado123 -&gt; Dashboard Empleado (invitado)</p>
          <p>- encargado.sst@empresa.com / E1234 -&gt; Dashboard Admin (encargado SST)</p>
        </div>
      </main>
    </div>
  );
}
