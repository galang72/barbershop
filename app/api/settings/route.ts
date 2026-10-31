import { NextRequest, NextResponse } from "next/server";
import { getShopSettings, updateShopSettings, resetDatabase } from "@/lib/db";
import { withCache, invalidateCache, TTL } from "@/lib/cache";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await withCache("settings:shop", () => getShopSettings(), TTL.SETTINGS);
    return NextResponse.json(settings, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = await updateShopSettings({
      shopName: body.shopName,
      address: body.address,
      phone: body.phone,
      receiptHeader: body.receiptHeader,
      receiptFooter: body.receiptFooter,
      initialCashFloat: body.initialCashFloat !== undefined ? Number(body.initialCashFloat) : undefined,
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session || (!session.role.startsWith("ADMIN") && session.role !== "ADMIN")) {
      return NextResponse.json({ error: "Hanya role Admin yang memiliki izin untuk mereset data!" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode === "clean" ? "clean" : "demo";
    await resetDatabase(mode);
    return NextResponse.json({
      success: true,
      mode,
      message:
        mode === "clean"
          ? "Riwayat transaksi kasir dan booking telah dikosongkan. Sistem siap digunakan untuk jualan riil!"
          : "Data demo barbershop berhasil di-reset ke kondisi awal default!",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
