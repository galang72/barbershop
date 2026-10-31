import { NextRequest, NextResponse } from "next/server";
import { getBarbermen, createBarberman, deleteBarberman, memoryDB, saveLocalDB, initMemoryDBIfNeeded, ensureSupabaseSchema } from "@/lib/db";
import { withCache, invalidateCache, TTL } from "@/lib/cache";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("all") === "true";
    const branch = searchParams.get("branch") || undefined;

    const cacheKey = `barbermen:${includeInactive}:${branch || "all"}`;
    const data = await withCache(cacheKey, () => getBarbermen(includeInactive, branch), TTL.BARBERMEN);

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    const body = await req.json();

    if (!body.name) {
      return NextResponse.json({ error: "Nama barberman wajib diisi" }, { status: 400 });
    }

    // Tentukan branch dari body atau dari session admin yang login
    if (!body.branch || body.branch === "All") {
      body.branch = (session?.branch && session.branch !== "All") ? session.branch : "Telkom";
    }

    const created = await createBarberman({
      name: body.name,
      nickname: body.nickname || body.name,
      phone: body.phone || "",
      branch: body.branch,
      isActive: true,
    });

    invalidateCache("barbermen");
    invalidateCache("dashboard");
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...rawData } = body;
    if (!id) {
      return NextResponse.json({ error: "ID barberman wajib diisi" }, { status: 400 });
    }

    // Update memoryDB DULU (selalu berhasil)
    await initMemoryDBIfNeeded();
    const idx = memoryDB.barbermen.findIndex((b: any) => b.id === id);
    if (idx !== -1) {
      const current = memoryDB.barbermen[idx];
      const sutaNames = ["ade", "arif", "akmal"];
      const isSutaDefault = sutaNames.some((n) => (current.name || "").toLowerCase().includes(n));
      const homeBranch = current.homeBranch || (isSutaDefault ? "Suta" : "Telkom");
      const targetWorking = rawData.workingBranch || rawData.branch || current.workingBranch || homeBranch;
      const isActive = rawData.isActive !== undefined ? rawData.isActive : (current.isActive !== false);
      const status = !isActive ? "LIBUR" : targetWorking !== homeBranch ? "DIPERBANTUKAN" : "AKTIF";

      // Jika ada perubahan cabang bertugas, catat ke riwayat penugasan
      if (targetWorking && targetWorking !== current.workingBranch) {
        if (!memoryDB.barberAssignments) memoryDB.barberAssignments = [];
        memoryDB.barberAssignments.unshift({
          id: "asg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          barbermanId: current.id,
          barbermanName: current.name,
          homeBranch,
          workingBranch: targetWorking,
          startDate: new Date().toISOString().split("T")[0],
          endDate: null,
          notes: `Penugasan ${current.name} ke Cabang ${targetWorking}`,
          status,
          createdBy: "Admin",
          createdAt: new Date().toISOString(),
        });
      }

      memoryDB.barbermen[idx] = {
        ...current,
        ...rawData,
        homeBranch,
        workingBranch: targetWorking,
        branch: targetWorking,
        isActive,
        status,
      };
      saveLocalDB();
    }

    // Coba update Supabase — coba dengan branch dulu, jika gagal coba tanpa branch
    let prismaSuccess = false;

    // Attempt 1: update semua field termasuk branch
    try {
      const prismaData: Record<string, any> = {};
      if (rawData.name !== undefined)          prismaData.name = rawData.name;
      if (rawData.nickname !== undefined)      prismaData.nickname = rawData.nickname;
      if (rawData.phone !== undefined)         prismaData.phone = rawData.phone;
      if (rawData.isActive !== undefined)      prismaData.isActive = rawData.isActive;
      if (rawData.branch !== undefined)        prismaData.branch = rawData.branch;
      if (rawData.workingBranch !== undefined) prismaData.workingBranch = rawData.workingBranch;
      if (rawData.homeBranch !== undefined)    prismaData.homeBranch = rawData.homeBranch;
      if (rawData.status !== undefined)        prismaData.status = rawData.status;
      if (rawData.photoUrl !== undefined)      prismaData.photoUrl = rawData.photoUrl;

      if (Object.keys(prismaData).length > 0) {
        await prisma.barberman.update({ where: { id }, data: prismaData });
        prismaSuccess = true;
        console.log("✅ Prisma barberman update sukses:", id, prismaData);
      }
    } catch (e1: any) {
      console.warn("⚠️ Prisma update attempt 1 gagal:", e1?.message);

      // Attempt 2: update tanpa field branch (jika kolom belum ada di Supabase)
      try {
        const prismaDataNoBranch: Record<string, any> = {};
        if (rawData.name !== undefined)      prismaDataNoBranch.name = rawData.name;
        if (rawData.nickname !== undefined)  prismaDataNoBranch.nickname = rawData.nickname;
        if (rawData.phone !== undefined)     prismaDataNoBranch.phone = rawData.phone;
        if (rawData.isActive !== undefined)  prismaDataNoBranch.isActive = rawData.isActive;
        if (rawData.photoUrl !== undefined)  prismaDataNoBranch.photoUrl = rawData.photoUrl;

        if (Object.keys(prismaDataNoBranch).length > 0) {
          await prisma.barberman.update({ where: { id }, data: prismaDataNoBranch });
          prismaSuccess = true;
          console.log("✅ Prisma barberman update (tanpa branch) sukses:", id);
        }
      } catch (e2: any) {
        console.warn("⚠️ Prisma update attempt 2 juga gagal:", e2?.message, "— tersimpan di memoryDB saja");
      }
    }

    invalidateCache("barbermen");
    invalidateCache("dashboard");

    const updated = idx !== -1 ? memoryDB.barbermen[idx] : { id, ...rawData };
    return NextResponse.json({ ...updated, _savedToDb: prismaSuccess });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    await deleteBarberman(id);
    invalidateCache("barbermen");
    invalidateCache("dashboard");
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
