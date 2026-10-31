import { NextRequest, NextResponse } from "next/server";
import { processCheckout, CheckoutPayload } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { invalidateCache } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();

    // D. OWNER TIDAK BOLEH MEMILIKI KASIR (Hapus kasir dari role Owner)
    if (session?.role === "OWNER") {
      return NextResponse.json(
        { error: "Akses Ditolak: Role Owner hanya bertugas untuk Monitoring dan Laporan, tidak memiliki akses kasir operasional." },
        { status: 403 }
      );
    }

    const body: CheckoutPayload = await req.json();

    if (!body.customerName || body.customerName.trim() === "") {
      return NextResponse.json({ error: "Nama Customer wajib diisi" }, { status: 400 });
    }

    if (!body.barbermanId) {
      return NextResponse.json({ error: "Silakan pilih Barberman yang bertugas" }, { status: 400 });
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: "Minimal pilih 1 layanan atau produk" }, { status: 400 });
    }

    if (!body.paymentMethod) {
      return NextResponse.json({ error: "Pilih metode pembayaran" }, { status: 400 });
    }

    // Cabang otomatis ditetapkan dari session admin yang login (keamanan data cabang)
    const branch = session?.role === "ADMIN_SUTA" ? "Suta" : "Telkom";

    const transaction = await processCheckout({
      ...body,
      branch,
    });

    invalidateCache("dashboard");
    invalidateCache("transactions");
    invalidateCache("barbermen");
    invalidateCache("customers");
    invalidateCache("cash");
    invalidateCache("reports");

    return NextResponse.json({
      success: true,
      transaction,
      message: `Transaksi kasir berhasil disimpan di Cabang ${branch}`,
    });
  } catch (error: any) {
    console.error("Kasir checkout error:", error);
    return NextResponse.json({ error: error.message || "Gagal memproses transaksi kasir" }, { status: 500 });
  }
}

