import { NextRequest, NextResponse } from "next/server";
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from "@/lib/db";
import { invalidateCache } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || searchParams.get("query") || undefined;
    const customers = await getCustomers(query);
    return NextResponse.json(customers, {
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
    const body = await req.json();
    if (!body.name || body.name.trim() === "") {
      return NextResponse.json({ error: "Nama customer wajib diisi" }, { status: 400 });
    }

    const created = await createCustomer({
      name: body.name.trim(),
      phone: body.phone?.trim() || null,
      instagram: body.instagram?.trim() || null,
      address: body.address?.trim() || null,
      notes: body.notes?.trim() || null,
      branch: body.branch?.trim() || "Telkom",
    });

    invalidateCache("customers");
    invalidateCache("dashboard");

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) {
      return NextResponse.json({ error: "ID customer wajib disertakan" }, { status: 400 });
    }
    if (data.name !== undefined && data.name.trim() === "") {
      return NextResponse.json({ error: "Nama customer tidak boleh kosong" }, { status: 400 });
    }

    const updated = await updateCustomer(id, data);
    invalidateCache("customers");
    invalidateCache("dashboard");

    return NextResponse.json(updated || { success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");
    if (!id) {
      try {
        const body = await req.json();
        id = body.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ error: "ID customer wajib disertakan" }, { status: 400 });
    }

    await deleteCustomer(id);
    invalidateCache("customers");
    invalidateCache("dashboard");

    return NextResponse.json({ success: true, message: "Customer berhasil dihapus" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
