const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'lib', 'db.ts');
let code = fs.readFileSync(dbPath, 'utf8');

const dashStart = code.indexOf('export async function getDashboardData(');
const dashEnd = code.indexOf('// LAPORAN KHUSUS (Pomade, Tonic & Powder', dashStart);

if (dashStart !== -1 && dashEnd !== -1) {
  // Backtrack to previous comment line
  const commentLine = code.lastIndexOf('// -------------------------------------------------------------', dashEnd);
  const actualEnd = commentLine !== -1 ? commentLine : dashEnd;

  const newDashboardData = `export async function getDashboardData(
  filter: "today" | "yesterday" | "week" | "month" | "year" | "custom" = "today",
  customStart?: string,
  customEnd?: string,
  branch?: string
) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();

  const now = new Date();
  let startDate = startOfDay(now);
  let endDate = endOfDay(now);

  if (filter === "yesterday") {
    const yest = subDays(now, 1);
    startDate = startOfDay(yest);
    endDate = endOfDay(yest);
  } else if (filter === "week") {
    startDate = startOfDay(subDays(now, 7));
    endDate = endOfDay(now);
  } else if (filter === "month") {
    startDate = startOfMonth(now);
    endDate = endOfMonth(now);
  } else if (filter === "year") {
    startDate = startOfYear(now);
    endDate = endOfYear(now);
  } else if (filter === "custom" && customStart && customEnd) {
    startDate = startOfDay(new Date(customStart));
    endDate = endOfDay(new Date(customEnd));
  }

  const startMonth = startOfMonth(now);
  const endMonth = endOfMonth(now);

  // Helper calculation for a specific branch or all
  const calcBranchStats = (bFilter?: string) => {
    let txs = memoryDB.transactions.filter((t: any) => {
      const d = new Date(t.createdAt);
      return d >= startDate && d <= endDate;
    });

    let mtxs = memoryDB.transactions.filter((t: any) => {
      const d = new Date(t.createdAt);
      return d >= startMonth && d <= endMonth;
    });

    if (bFilter && bFilter !== "All") {
      txs = txs.filter((t: any) => t.branch === bFilter);
      mtxs = mtxs.filter((t: any) => t.branch === bFilter);
    }

    let revenue = 0;
    let productSalesRevenue = 0;
    for (const tx of txs) {
      revenue += tx.grandTotal || 0;
      const items = memoryDB.transactionItems.filter((i: any) => i.transactionId === tx.id);
      for (const item of items) {
        if (item.itemType === "PRODUCT") {
          productSalesRevenue += item.subtotal || 0;
        }
      }
    }

    let monthRevenue = 0;
    for (const tx of mtxs) {
      monthRevenue += tx.grandTotal || 0;
    }

    let bks = memoryDB.bookings.filter((b: any) => {
      const d = new Date(b.bookingDate);
      return d >= startOfDay(now) && d <= endOfDay(now);
    });
    if (bFilter && bFilter !== "All") {
      bks = bks.filter((b: any) => b.branch === bFilter);
    }

    const memberCount = memoryDB.members.filter((m: any) => m.status === "ACTIVE").length;

    let prods = memoryDB.products.filter((p: any) => p.isActive);
    let lowStock = 0;
    for (const p of prods) {
      const st = bFilter === "Suta" ? (p.stockSuta ?? p.stock) : bFilter === "Telkom" ? (p.stockTelkom ?? p.stock) : p.stock;
      if (st <= (p.minStock || 5)) lowStock++;
    }

    let cashIn = 0;
    let cashOut = 0;
    for (const c of memoryDB.cashTransactions) {
      if (bFilter && bFilter !== "All" && c.branch && c.branch !== bFilter) continue;
      if (c.type === "CASH_IN") cashIn += c.amount || 0;
      else if (c.type === "CASH_OUT") cashOut += c.amount || 0;
    }
    const initF = bFilter === "Suta"
      ? (memoryDB.shopSettings?.initialCashFloatSuta ?? 100000)
      : bFilter === "Telkom"
      ? (memoryDB.shopSettings?.initialCashFloatTelkom ?? 100000)
      : ((memoryDB.shopSettings?.initialCashFloatTelkom ?? 100000) + (memoryDB.shopSettings?.initialCashFloatSuta ?? 100000));

    const cashInHand = initF + cashIn - cashOut;

    return {
      todayCustomer: txs.length,
      todayTransaction: txs.length,
      todayRevenue: revenue,
      monthRevenue,
      todayBooking: bks.length,
      totalMember: memberCount,
      totalProduct: prods.length,
      lowStockProducts: lowStock,
      productSalesRevenue,
      cashInHand,
    };
  };

  // S, T, U. Performa 6 Barberman & Tidak Double Count
  const allBarbers = await getBarbermen(true);
  const relevantTxs = memoryDB.transactions.filter((t: any) => {
    const d = new Date(t.createdAt);
    const dateMatch = d >= startDate && d <= endDate;
    if (!dateMatch) return false;
    if (branch && branch !== "All") {
      return t.branch === branch;
    }
    return true;
  });

  const barberPerformance = allBarbers.map((barber: any) => {
    const bTxs = relevantTxs.filter((t: any) => t.barbermanId === barber.id);
    // T. JANGAN DOUBLE COUNT: Gunakan unique customer/transaksi
    const bCust = bTxs.length;
    const bOmzet = bTxs.reduce((acc: number, t: any) => acc + (t.grandTotal || 0), 0);

    return {
      id: barber.id,
      name: barber.name,
      nickname: barber.nickname,
      homeBranch: barber.homeBranch,
      workingBranch: barber.workingBranch,
      branch: barber.workingBranch,
      status: barber.status,
      customers: bCust,
      transactions: bCust,
      omzet: bOmzet,
    };
  });

  const recentActivities = (memoryDB.activities || []).slice(0, 10);

  // Jika branch spesifik diminta (Admin Telkom / Admin Suta)
  if (branch && branch !== "All") {
    return {
      filter,
      branch,
      metrics: calcBranchStats(branch),
      barberPerformance: barberPerformance.filter((b: any) => b.workingBranch === branch),
      recentActivities: recentActivities.filter((a: any) => a.branch === branch || a.branch === "All"),
    };
  }

  // Jika Owner (Semua Cabang): Berikan ringkasan per cabang & gabungan (BG)
  const telkomMetrics = calcBranchStats("Telkom");
  const sutaMetrics = calcBranchStats("Suta");
  const totalMetrics = calcBranchStats("All");

  return {
    filter,
    branch: "All",
    metrics: totalMetrics,
    telkomMetrics,
    sutaMetrics,
    totalMetrics,
    barberPerformance,
    recentActivities,
  };
}

`;

  code = code.substring(0, dashStart) + newDashboardData + code.substring(actualEnd);
  fs.writeFileSync(dbPath, code, 'utf8');
  console.log("Successfully replaced getDashboardData!");
} else {
  console.warn("Could not find getDashboardData boundaries", { dashStart, dashEnd });
}
