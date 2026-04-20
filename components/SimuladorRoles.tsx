"use client";

type Rol = "empleado" | "administrador";

type SimuladorRolesProps = {
  rol: Rol;
  onRolChange: (rol: Rol) => void;
};

export default function SimuladorRoles({ rol, onRolChange }: SimuladorRolesProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <label htmlFor="rol-selector" className="mb-2 block text-sm font-semibold text-zinc-700">
        Simulador de usuario
      </label>
      <select
        id="rol-selector"
        value={rol}
        onChange={(event) => onRolChange(event.target.value as Rol)}
        className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
      >
        <option className="bg-white text-zinc-900" value="empleado">Rol: Empleado (Reportador)</option>
        <option className="bg-white text-zinc-900" value="administrador">Rol: Administrador (Revisor)</option>
      </select>
    </section>
  );
}
