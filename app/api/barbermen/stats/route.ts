import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "monthly"; // daily | monthly | annual
    const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const monthNum = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
    const yearNum = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
    const reqBranch = searchParams.get("branch") || undefined;

    // Role-based branch security: admins can only see their own branch
    const sessionBranch = session?.branch;
    let branch: string | undefined;
    if (sessionBranch && sessionBranch !== "All") {
      branch = sessionBranch;
    } else {
      branch = reqBranch; // Owner can pick any branch
    }

    // Calculate date range
    let startDate: Date;
    let endDate: Date;
    if (period === "daily") {
      const d = new Date(dateStr);
      startDate = startOfDay(d);
      endDate = endOfDay(d);
    } else if (period === "monthly") {
      const d = new Date(yearNum, monthNum - 1, 1);
      startDate = startOfMonth(d);
      endDate = endOfMonth(d);
    } else {
      // annual
      startDate = startOfYear(new Date(yearNum, 0, 1));
      endDate = endOfYear(new Date(yearNum, 0, 1));
    }

    const txWhere: any = { createdAt: { gte: startDate, lte: endDate } };
    if (branch && branch !== "All") txWhere.branch = branch;

    const [transactions, allBarbermen] = await Promise.all([
      prisma.transaction.findMany({
        where: txWhere,
        select: {
          id: true,
          barbermanId: true,
          customerId: true,
          customerName: true,
          grandTotal: true,
          branch: true,
          createdAt: true,
          paymentMethod: true,
          items: { select: { itemType: true, quantity: true, subtotal: true } },
        },
      }).catch(() => []),
      prisma.barberman.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      }).catch(() => []),
    ]);

    const stats = allBarbermen.map((barber: any) => {
      const barberTxs = transactions.filter((t: any) => t.barbermanId === barber.id);
      const telkomTxs = barberTxs.filter((t: any) => t.branch === "Telkom");
      const sutaTxs = barberTxs.filter((t: any) => t.branch === "Suta");

      const totalOmzet = barberTxs.reduce((s: number, t: any) => s + (t.grandTotal || 0), 0);
      const telkomOmzet = telkomTxs.reduce((s: number, t: any) => s + (t.grandTotal || 0), 0);
      const sutaOmzet = sutaTxs.reduce((s: number, t: any) => s + (t.grandTotal || 0), 0);

      const uniqueCustomers = new Set(barberTxs.map((t: any) => t.customerId || t.customerName)).size;
      const telkomCustomers = new Set(telkomTxs.map((t: any) => t.customerId || t.customerName)).size;
      const sutaCustomers = new Set(sutaTxs.map((t: any) => t.customerId || t.customerName)).size;

      let serviceCount = 0;
      for (const t of barberTxs) {
        for (const it of (t as any).items || []) {
          if (it.itemType === "SERVICE") serviceCount += it.quantity || 1;
        }
      }

      const sutaNames = ["ade", "arif", "akmal"];
      const isSutaDefault = sutaNames.some((n) => (barber.name || "").toLowerCase().includes(n));
      const homeBranch = barber.homeBranch || (isSutaDefault ? "Suta" : "Telkom");

      return {
        id: barber.id,
        name: barber.name,
        nickname: barber.nickname,
        homeBranch,
        workingBranch: barber.workingBranch || barber.branch || homeBranch,
        isActive: barber.isActive,
        totalTransactions: barberTxs.length,
        totalCustomers: uniqueCustomers,
        telkomTransactions: telkomTxs.length,
        telkomCustomers,
        telkomOmzet,
        sutaTransactions: sutaTxs.length,
        sutaCustomers,
        sutaOmzet,
        totalOmzet,
        serviceCount,
        averagePerCustomer: uniqueCustomers > 0 ? Math.round(totalOmzet / uniqueCustomers) : 0,
      };
    });

    // Filter to only include barbermen relevant to the branch requested
    const filtered =
      branch && branch !== "All"
        ? stats.filter(
            (s: any) =>
              s.homeBranch === branch ||
              s.workingBranch === branch ||
              s.telkomTransactions > 0 ||
              s.sutaTransactions > 0
          )
        : stats;

    return NextResponse.json({
      period,
      branch: branch || "All",
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      stats: filtered,
      summary: {
        totalTransactions: transactions.length,
        totalOmzet: transactions.reduce((s: number, t: any) => s + (t.grandTotal || 0), 0),
        totalCustomers: new Set(transactions.map((t: any) => t.customerId || t.customerName)).size,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
