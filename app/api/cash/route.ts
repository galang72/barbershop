import { NextRequest, NextResponse } from "next/server";
import { getCashLedger, createCashEntry, updateShopSettings } from "@/lib/db";
import { getAdminSession, resolveBranchFilter } from "@/lib/auth";
import { invalidateCache } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    const { searchParams } = new URL(req.url);
    const branch = resolveBranchFilter(session, searchParams.get("branch"));

    const data = await getCashLedger(branch);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
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
    const { type, category, amount, description, source } = body;

    if (!type || !category || !amount || !description) {
      return NextResponse.json({ error: "Lengkapi data kas (Tipe, Kategori, Nominal, Keterangan)" }, { status: 400 });
    }

    const branch = body.branch || (session?.role === "ADMIN_SUTA" ? "Suta" : "Telkom");

    const created = await createCashEntry({
      type,
      category,
      amount: Number(amount),
      description: String(description).trim(),
      source: source || "MANUAL",
      branch,
    });

    invalidateCache("cash");
    invalidateCache("dashboard");
    invalidateCache("reports");

    return NextResponse.json({
      success: true,
      data: created,
    });
  } catch (err: any) {
    console.error("❌ [API /api/cash POST] error:", err?.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { initialFloat } = body;
    if (initialFloat === undefined || isNaN(Number(initialFloat))) {
      return NextResponse.json({ error: "Nominal modal kas awal tidak valid" }, { status: 400 });
    }

    const updated = await updateShopSettings({
      initialCashFloat: Number(initialFloat),
    });

    invalidateCache("cash");
    invalidateCache("dashboard");

    return NextResponse.json({
      success: true,
      initialCashFloat: updated.initialCashFloat,
      message: "Modal kas awal laci berhasil diperbarui!",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
