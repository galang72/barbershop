import { NextRequest, NextResponse } from "next/server";
import { assignBarberman, getBarberAssignments } from "@/lib/db";
import { getAdminSession, resolveBranchFilter } from "@/lib/auth";
import { invalidateCache } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    const { searchParams } = new URL(req.url);
    const branch = resolveBranchFilter(session, searchParams.get("branch"));

    const assignments = await getBarberAssignments(branch);
    return NextResponse.json({ assignments }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    const body = await req.json();
    const { barbermanId, targetBranch, startDate, endDate, notes } = body;

    if (!barbermanId || !targetBranch) {
      return NextResponse.json(
        { error: "Barberman dan Cabang Tujuan wajib dipilih" },
        { status: 400 }
      );
    }

    if (targetBranch !== "Telkom" && targetBranch !== "Suta") {
      return NextResponse.json(
        { error: "Cabang tujuan harus Telkom atau Suta" },
        { status: 400 }
      );
    }

    const assignedBy = session?.name || (session?.role === "ADMIN_TELKOM" ? "Admin Telkom" : session?.role === "ADMIN_SUTA" ? "Admin Suta" : "Owner");

    const result = await assignBarberman({
      barbermanId,
      targetBranch,
      startDate: startDate || new Date().toISOString().split("T")[0],
      endDate,
      notes,
      assignedBy,
    });

    invalidateCache("barbermen");
    invalidateCache("dashboard");

    return NextResponse.json({
      success: true,
      message: `Penugasan barberman ke Cabang ${targetBranch} berhasil disimpan`,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
