import { NextRequest, NextResponse } from "next/server";
import { getBookings, createBooking, updateBookingStatus } from "@/lib/db";
import { invalidateCache } from "@/lib/cache";
import { getAdminSession, resolveBranchFilter } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DP_AMOUNT = 20000; // DP wajib Rp 20.000

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || undefined;
    const branch = resolveBranchFilter(session, searchParams.get("branch"));

    const bookings = await getBookings(date, branch);
    return NextResponse.json(bookings, {
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    const body = await req.json();

    if (!body.customerName || !body.barbermanId || !body.serviceId || !body.bookingDate || !body.bookingTime) {
      return NextResponse.json(
        { error: "Lengkapi data booking (Nama, Barberman, Layanan, Tanggal, Jam)" },
        { status: 400 }
      );
    }

    // Cabang otomatis ditetapkan dari session admin yang login (keamanan data cabang)
    const branch = session?.role === "ADMIN_SUTA"
      ? "Suta"
      : session?.role === "ADMIN_TELKOM"
      ? "Telkom"
      : (body.branch || "Telkom");

    const created = await createBooking({
      customerId: body.customerId || null,
      customerName: body.customerName.trim(),
      customerPhone: body.customerPhone?.trim() || null,
      barbermanId: body.barbermanId,
      serviceId: body.serviceId,
      bookingDate: new Date(body.bookingDate),
      bookingTime: body.bookingTime,
      notes: body.notes || null,
      branch,
      dpPaid: DP_AMOUNT,
      dpStatus: body.dpStatus || "SUDAH_DIBAYAR",
      status: body.status || "CONFIRMED",
    });

    invalidateCache("bookings:");
    return NextResponse.json({
      ...created,
      message: `Booking berhasil di Cabang ${branch}! DP Rp ${DP_AMOUNT.toLocaleString("id-ID")} telah dicatat.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status } = body;
    if (!id || !status) {
      return NextResponse.json({ error: "ID dan status wajib diisi" }, { status: 400 });
    }
    const updated = await updateBookingStatus(id, status);
    invalidateCache("bookings:");
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

