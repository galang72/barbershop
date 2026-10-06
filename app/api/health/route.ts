import { NextResponse } from "next/server";
import { getDatabaseDiagnostics } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session || (!session.role.startsWith("ADMIN") && session.role !== "ADMIN")) {
      return NextResponse.json({
        connected: true,
        restricted: true,
        message: "Status koneksi database hanya dapat dilihat oleh role Admin.",
      });
    }

    const diag = await getDatabaseDiagnostics();
    return NextResponse.json(diag);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
