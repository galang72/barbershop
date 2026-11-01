import { NextRequest, NextResponse } from "next/server";
import { getMembers, createMember, extendMember, deleteMember, updateMember, getMemberDetail } from "@/lib/db";
import { invalidateCache } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || undefined;
    const id = searchParams.get("id");

    if (id) {
      const member = await getMemberDetail(id);
      if (!member) {
        return NextResponse.json({ error: "Member tidak ditemukan" }, { status: 404 });
      }
      return NextResponse.json(member);
    }

    const data = await getMembers(query);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15" },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name || !body.packageName || !body.durationDays) {
      return NextResponse.json({ error: "Nama, paket, dan durasi member wajib diisi" }, { status: 400 });
    }

    const created = await createMember({
      name: body.name.trim(),
      phone: body.phone?.trim() || null,
      packageName: body.packageName,
      durationDays: Number(body.durationDays),
      customerId: body.customerId || null,
    });

    invalidateCache("members:");
    return NextResponse.json({ success: true, member: created });
  } catch (err: any) {
    const isDuplicate = err.message?.includes("sudah memiliki membership");
    return NextResponse.json({ error: err.message }, { status: isDuplicate ? 409 : 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.additionalDays !== undefined) {
      // Perpanjangan masa aktif
      const { id, additionalDays } = body;
      if (!id || !additionalDays) {
        return NextResponse.json({ error: "ID dan tambahan hari wajib diisi" }, { status: 400 });
      }
      const updated = await extendMember(id, Number(additionalDays));
      invalidateCache("members:");
      return NextResponse.json({ success: true, member: updated });
    }

    // Edit profil member
    const { id, ...data } = body;
    if (!id) {
      return NextResponse.json({ error: "ID member wajib diisi" }, { status: 400 });
    }
    const updated = await updateMember(id, data);
    invalidateCache("members:");
    return NextResponse.json({ success: true, member: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID member wajib diisi" }, { status: 400 });

    await deleteMember(id);
    invalidateCache("members:");
    return NextResponse.json({ success: true, message: "Member berhasil dihapus" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
