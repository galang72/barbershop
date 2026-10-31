import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { seedDemoTransactionsToSupabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== "OWNER") {
      return NextResponse.json({ error: "Hanya OWNER yang bisa seed data demo" }, { status: 403 });
    }

    const res = await seedDemoTransactionsToSupabase();
    return NextResponse.json({
      success: true,
      message: `✅ Berhasil menyemai data demo ke Supabase (${res.count} transaksi)`,
      count: res.count,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const txCount = await prisma.transaction.count();
    const customerCount = await prisma.customer.count();
    return NextResponse.json({ txCount, customerCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
