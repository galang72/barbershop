import { NextRequest, NextResponse } from "next/server";
import { getBookings, createBooking, updateBooking, deleteBooking } from "@/lib/db";
import { invalidateCache } from "@/lib/cache";
import { getAdminSession, resolveBranchFilter } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || undefined;
    const branch = resolveBranchFilter(session, searchParams.get("branch"));

    const bookings = await getBookings(date, branch);
    return NextResponse.json(bookings, {
      headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15" },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();

    // 🔒 ROLE AUTHORIZATION: Owner read-only
    if (session?.role === "OWNER") {
      return NextResponse.json(
        { error: "Akses Ditolak: Role Owner hanya bertugas untuk Monitoring dan Laporan, tidak memiliki akses membuat booking operasional." },
        { status: 403 }
      );
    }

    const body = await req.json();

    if (!body.customerName || !body.barbermanId || !body.serviceId || !body.bookingDate || !body.bookingTime) {
      return NextResponse.json(
        { error: "Lengkapi data booking (Nama Customer, Barberman, Layanan, Tanggal, Jam)" },
        { status: 400 }
      );
    }

    // Cabang otomatis divalidasi dari role admin
    const targetBranch = session?.role === "ADMIN_SUTA"
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
      branch: targetBranch,
      dpAmount: Number(body.dpAmount || 20000),
      dpStatus: body.dpStatus || "BELUM_BAYAR",
      dpMethod: body.dpMethod || null,
      status: body.status || "CONFIRMED",
    });

    invalidateCache("bookings:");
    invalidateCache("dashboard");
    invalidateCache("cash");
    invalidateCache("reports");
    invalidateCache("cash");
    invalidateCache("reports");

    return NextResponse.json({
      success: true,
      booking: created,
      message: `Booking berhasil dibuat di Cabang ${targetBranch}!`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getAdminSession();

    // 🔒 ROLE AUTHORIZATION: Owner read-only
    if (session?.role === "OWNER") {
      return NextResponse.json(
        { error: "Akses Ditolak: Role Owner tidak dapat mengedit booking." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, ...data } = body;
    if (!id) {
      return NextResponse.json({ error: "ID booking wajib diisi" }, { status: 400 });
    }

    // Validasi otorisasi cabang untuk admin cabang
    if (session?.role === "ADMIN_TELKOM" && data.branch && data.branch !== "Telkom") {
      return NextResponse.json({ error: "Akses Ditolak: Anda hanya berwenang untuk Cabang Telkom" }, { status: 403 });
    }
    if (session?.role === "ADMIN_SUTA" && data.branch && data.branch !== "Suta") {
      return NextResponse.json({ error: "Akses Ditolak: Anda hanya berwenang untuk Cabang Suta" }, { status: 403 });
    }

    const updated = await updateBooking(id, data);
    invalidateCache("bookings:");
    invalidateCache("dashboard");
    invalidateCache("cash");
    invalidateCache("reports");
    invalidateCache("cash");
    invalidateCache("reports");

    return NextResponse.json({
      success: true,
      booking: updated,
      message: `Data booking ${updated.customerName} berhasil diperbarui.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getAdminSession();

    if (session?.role === "OWNER") {
      return NextResponse.json(
        { error: "Akses Ditolak: Role Owner tidak dapat mengubah status booking." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, status, dpStatus, dpMethod } = body;
    if (!id) {
      return NextResponse.json({ error: "ID booking wajib diisi" }, { status: 400 });
    }

    const updated = await updateBooking(id, {
      ...(status ? { status } : {}),
      ...(dpStatus ? { dpStatus } : {}),
      ...(dpMethod ? { dpMethod } : {}),
    });

    invalidateCache("bookings:");
    invalidateCache("dashboard");
    invalidateCache("cash");
    invalidateCache("reports");
    invalidateCache("cash");
    invalidateCache("reports");

    return NextResponse.json({ success: true, booking: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getAdminSession();

    if (session?.role === "OWNER") {
      return NextResponse.json(
        { error: "Akses Ditolak: Role Owner tidak dapat menghapus booking." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID booking wajib diisi" }, { status: 400 });
    }

    await deleteBooking(id);

    invalidateCache("bookings:");
    invalidateCache("dashboard");
    invalidateCache("cash");
    invalidateCache("reports");

    return NextResponse.json({ success: true, message: "Booking berhasil dihapus." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
