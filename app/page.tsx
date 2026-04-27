"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerUsuarioSesion, supabase } from "@/utils/supabase";

export default function Home() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [modoRegistro, setModoRegistro] = useState(false);
  const [correoRegistro, setCorreoRegistro] = useState("");
  const [contrasenaRegistro, setContrasenaRegistro] = useState("");
  const [confirmarContrasenaRegistro, setConfirmarContrasenaRegistro] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [cargandoLogin, setCargandoLogin] = useState(false);
  const [cargandoRegistro, setCargandoRegistro] = useState(false);

  useEffect(() => {
    const validarSesion = async () => {
      const usuario = await obtenerUsuarioSesion();
      if (!usuario) {
        return;
      }

      router.push(usuario.rol === "ADMIN" ? "/dashboard/admin" : "/dashboard/empleado");
    };

    void validarSesion();
  }, [router]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const correoLimpio = correo.trim().toLowerCase();
    setError(null);
    setMensaje(null);

    if (!correoLimpio || !contrasena) {
      alert("Credenciales incorrectas");
      return;
    }

    setCargandoLogin(true);

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: correoLimpio,
      password: contrasena,
    });

    if (loginError) {
      setError(`No fue posible iniciar sesion: ${loginError.message}`);
      setCargandoLogin(false);
      return;
    }

    const usuario = await obtenerUsuarioSesion();
    setCargandoLogin(false);

    if (!usuario) {
      setError("Sesion iniciada, pero no fue posible obtener el perfil del usuario.");
      return;
    }

    router.push(usuario.rol === "ADMIN" ? "/dashboard/admin" : "/dashboard/empleado");
  };

  const handleRegistro = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMensaje(null);

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

    setCargandoRegistro(true);

    const { data, error: registroError } = await supabase.auth.signUp({
      email: correoLimpio,
      password: contrasenaRegistro,
      options: {
        data: {
          role: "EMPLEADO",
        },
      },
    });

    if (registroError) {
      setError(`No fue posible crear la cuenta: ${registroError.message}`);
      setCargandoRegistro(false);
      return;
    }

    if (!data.session) {
      setMensaje("Cuenta creada. Revisa tu correo para confirmar la cuenta antes de iniciar sesion.");
    } else {
      setMensaje("Cuenta creada. Ya puedes ingresar con tu nuevo usuario.");
    }

    setCorreoRegistro("");
    setContrasenaRegistro("");
    setConfirmarContrasenaRegistro("");
    setModoRegistro(false);
    setCorreo(correoLimpio);
    setContrasena(contrasenaRegistro);
    setCargandoRegistro(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-10">
      <main className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Ingreso SST</p>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Iniciar sesion</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Autenticacion con Supabase Auth. El rol del usuario se toma desde metadata (ADMIN o EMPLEADO).
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
            disabled={cargandoLogin}
            className="inline-flex w-full items-center justify-center rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-900"
          >
            {cargandoLogin ? "Ingresando..." : "Ingresar"}
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
              disabled={cargandoRegistro}
              className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
            >
              {cargandoRegistro ? "Creando cuenta..." : "Crear cuenta empleado"}
            </button>
          </form>
        )}

        {mensaje && <p className="mt-4 text-sm text-emerald-700">{mensaje}</p>}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 leading-5">
          
          <p className="mt-2 font-semibold text-zinc-700">Credenciales de referencia:</p>
          <p>- Invitado: invitado@sst.com / Invitado123</p>
          <p>- Admin: encargado.sst@empresa.com / E1234</p>
        </div>
      </main>
    </div>
  );
}
