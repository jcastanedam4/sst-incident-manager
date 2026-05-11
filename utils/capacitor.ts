import { Capacitor } from "@capacitor/core";

export const esAplicacionNativa = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return Capacitor.isNativePlatform();
};