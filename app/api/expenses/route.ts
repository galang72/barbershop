import { NextRequest, NextResponse } from "next/server";
import { getExpenses, createExpense, deleteExpense } from "@/lib/db";
import { getAdminSession, resolveBranchFilter } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak valid atau telah berakhir. Silakan login kembali." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedBranch = searchParams.get("branch");
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const category = searchParams.get("category") || undefined;
    const paymentMethod = searchParams.get("paymentMethod") || undefined;

    // Backend Role-Based Authorization
    const branch = resolveBranchFilter(session, requestedBranch);

    const expenses = await getExpenses({
      branch,
      startDate,
      endDate,
      category,
      paymentMethod,
    });

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    let totalExpenses = 0;
    let todayExpenses = 0;
    let cashExpenses = 0;
    let nonCashExpenses = 0;
    let telkomExpenses = 0;
    let sutaExpenses = 0;

    for (const item of expenses) {
      const amt = Number(item.amount || 0);
      totalExpenses += amt;

      const itemDateStr = new Date(item.expenseDate || item.createdAt).toISOString().split("T")[0];
      if (itemDateStr === todayStr) {
        todayExpenses += amt;
      }

      if (item.paymentMethod === "CASH") {
        cashExpenses += amt;
      } else {
        nonCashExpenses += amt;
      }

      if (item.branch === "Suta") {
        sutaExpenses += amt;
      } else {
        telkomExpenses += amt;
      }
    }

    return NextResponse.json(
      {
        success: true,
        expenses,
        summary: {
          totalExpenses,
          todayExpenses,
          cashExpenses,
          nonCashExpenses,
          telkomExpenses,
          sutaExpenses,
          count: expenses.length,
        },
        branch: branch || "All",
        userRole: session.role,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err: any) {
    console.error("❌ [API Expenses GET] Error:", err);
    return NextResponse.json({ error: err.message || "Gagal memuat data pengeluaran" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { error: "Akses Ditolak: Sesi admin tidak valid. Silakan login kembali." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { category, amount, description, expenseDate, paymentMethod } = body;

    // Validasi Input
    if (!category || !String(category).trim()) {
      return NextResponse.json({ error: "Kategori pengeluaran wajib dipilih" }, { status: 400 });
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: "Nominal pengeluaran harus berupa angka lebih dari Rp 0" }, { status: 400 });
    }
    if (!description || !String(description).trim()) {
      return NextResponse.json({ error: "Keterangan / rincian pengeluaran wajib diisi" }, { status: 400 });
    }

    // Role-based branch determination
    let branch = "Telkom";
    if (session.role === "ADMIN_TELKOM") {
      branch = "Telkom";
    } else if (session.role === "ADMIN_SUTA") {
      branch = "Suta";
    } else if (session.role === "OWNER") {
      branch = body.branch === "Suta" ? "Suta" : "Telkom";
    }

    const validMethods = ["CASH", "QRIS", "TRANSFER", "DEBIT", "KREDIT", "E_WALLET"];
    const resolvedMethod = validMethods.includes(paymentMethod) ? paymentMethod : "CASH";

    const created = await createExpense({
      category: String(category).trim(),
      amount: numAmount,
      description: String(description).trim(),
      expenseDate: expenseDate || new Date().toISOString(),
      paymentMethod: resolvedMethod,
      branch,
      actor: session.name || session.username || "Admin",
    });

    return NextResponse.json(
      {
        success: true,
        expense: created,
        message: `Pengeluaran sebesar Rp ${numAmount.toLocaleString("id-ID")} berhasil disimpan ke Supabase!`,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("❌ [API Expenses POST] Error:", err);
    return NextResponse.json(
      { error: err.message || "Gagal menyimpan pengeluaran ke database Supabase" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Akses Ditolak" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID pengeluaran wajib disertakan" }, { status: 400 });
    }

    // Ambil data untuk validasi branch
    const all = await getExpenses();
    const target = all.find((e: any) => e.id === id);

    if (target) {
      if (session.role === "ADMIN_TELKOM" && target.branch === "Suta") {
        return NextResponse.json({ error: "Admin Telkom tidak diizinkan menghapus pengeluaran Cabang Suta" }, { status: 403 });
      }
      if (session.role === "ADMIN_SUTA" && target.branch === "Telkom") {
        return NextResponse.json({ error: "Admin Suta tidak diizinkan menghapus pengeluaran Cabang Telkom" }, { status: 403 });
      }
    }

    await deleteExpense(id);

    return NextResponse.json({
      success: true,
      message: "Data pengeluaran berhasil dihapus!",
    });
  } catch (err: any) {
    console.error("❌ [API Expenses DELETE] Error:", err);
    return NextResponse.json({ error: err.message || "Gagal menghapus data pengeluaran" }, { status: 500 });
  }
}

