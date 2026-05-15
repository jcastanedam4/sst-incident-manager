import { NextResponse } from "next/server";
import supabaseAdmin from "@/utils/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { incidente_id, url_storage, tipo_archivo } = body;

    if (!incidente_id || !url_storage) {
      return NextResponse.json({ error: "Missing incidente_id or url_storage" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("evidencias").insert({
      incidente_id,
      url_storage,
      tipo_archivo: tipo_archivo ?? null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
