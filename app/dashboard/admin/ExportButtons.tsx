"use client";
import React, { useState } from "react";
import { exportarIncidentesExcel, exportarIndicadoresPdf } from "@/utils/reportes";

export default function ExportButtons({ incidentes }: { incidentes: any[] }) {
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingExcel, setLoadingExcel] = useState(false);

  const handlePdf = async () => {
    try {
      setLoadingPdf(true);
      await exportarIndicadoresPdf(incidentes);
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleExcel = async () => {
    try {
      setLoadingExcel(true);
      await exportarIncidentesExcel(incidentes);
    } finally {
      setLoadingExcel(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handlePdf}
        disabled={loadingPdf}
        className={`rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 ${
          loadingPdf ? "opacity-60 cursor-wait" : ""
        }`}
      >
        {loadingPdf ? "Generando PDF..." : "Exportar PDF"}
      </button>

      <button
        type="button"
        onClick={handleExcel}
        disabled={loadingExcel}
        className={`rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 ${
          loadingExcel ? "opacity-60 cursor-wait" : ""
        }`}
      >
        {loadingExcel ? "Generando Excel..." : "Exportar Excel"}
      </button>
    </>
  );
}
