export const esAplicacionNativa = (): boolean => {
  try {
    // Seguridad SSR: verifica que `window`/`globalThis` exista y tenga `Capacitor`
    const g: any = typeof globalThis !== "undefined" ? globalThis : {}
    const Cap = g.Capacitor
    if (!Cap) return false
    // En entornos nativos, Capacitor suele exponer platform o isNativePlatform
    if (typeof Cap.isNativePlatform === "function") return Cap.isNativePlatform()
    if (Cap.platform && Cap.platform !== "web") return true
    return false
  } catch {
    return false
  }
}

export default esAplicacionNativa
