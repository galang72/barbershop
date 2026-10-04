import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Data demo: 20 transaksi Telkom + 10 Suta
const DEMO_CUSTOMERS = [
  // Telkom customers
  { id: "cust_demo_t01", name: "Hilal Pratama",       phone: "081200010001", branch: "Telkom" },
  { id: "cust_demo_t02", name: "Fadlullah Fahmi",      phone: "081200010002", branch: "Telkom" },
  { id: "cust_demo_t03", name: "Nadhim Alamsyah",      phone: "081200010003", branch: "Telkom" },
  { id: "cust_demo_t04", name: "Admu Ramadhan",        phone: "081200010004", branch: "Telkom" },
  { id: "cust_demo_t05", name: "Rifky Aditya",         phone: "081200010005", branch: "Telkom" },
  { id: "cust_demo_t06", name: "Bagas Prasetyo",       phone: "081200010006", branch: "Telkom" },
  { id: "cust_demo_t07", name: "Yusuf Habibi",         phone: "081200010007", branch: "Telkom" },
  { id: "cust_demo_t08", name: "Haris Munandar",       phone: "081200010008", branch: "Telkom" },
  { id: "cust_demo_t09", name: "Alex Denhaq",          phone: "081200010009", branch: "Telkom" },
  { id: "cust_demo_t10", name: "Dimas Setiawan",       phone: "081200010010", branch: "Telkom" },
  { id: "cust_demo_t11", name: "Fikri Haikal",         phone: "081200010011", branch: "Telkom" },
  { id: "cust_demo_t12", name: "Iqbal Tawakal",        phone: "081200010012", branch: "Telkom" },
  { id: "cust_demo_t13", name: "Aldi Taher",           phone: "081200010013", branch: "Telkom" },
  { id: "cust_demo_t14", name: "Gilang Ramadhan",      phone: "081200010014", branch: "Telkom" },
  { id: "cust_demo_t15", name: "Deva Narendra",        phone: "081200010015", branch: "Telkom" },
  { id: "cust_demo_t16", name: "Avicena Novianto",     phone: "081200010016", branch: "Telkom" },
  { id: "cust_demo_t17", name: "Syamil Basalamah",     phone: "081200010017", branch: "Telkom" },
  { id: "cust_demo_t18", name: "Kaniza Ardiansyah",    phone: "081200010018", branch: "Telkom" },
  { id: "cust_demo_t19", name: "Kevin Sanjaya",        phone: "081200010019", branch: "Telkom" },
  { id: "cust_demo_t20", name: "Maulana Malik",        phone: "081200010020", branch: "Telkom" },
  // Suta customers
  { id: "cust_demo_s01", name: "Fajar Nugraha",        phone: "081200020001", branch: "Suta" },
  { id: "cust_demo_s02", name: "Erix Soekamti",        phone: "081200020002", branch: "Suta" },
  { id: "cust_demo_s03", name: "Galih Ginanjar",       phone: "081200020003", branch: "Suta" },
  { id: "cust_demo_s04", name: "Mian Tiarno",          phone: "081200020004", branch: "Suta" },
  { id: "cust_demo_s05", name: "Budi Hartono",         phone: "081200020005", branch: "Suta" },
  { id: "cust_demo_s06", name: "Rian D'Masiv",         phone: "081200020006", branch: "Suta" },
  { id: "cust_demo_s07", name: "Bayu Skak",            phone: "081200020007", branch: "Suta" },
  { id: "cust_demo_s08", name: "Reza Rahadian",        phone: "081200020008", branch: "Suta" },
  { id: "cust_demo_s09", name: "Hendra Setiawan",      phone: "081200020009", branch: "Suta" },
  { id: "cust_demo_s10", name: "Deni Cagur",           phone: "081200020010", branch: "Suta" },
];

// 20 Telkom + 10 Suta transactions
const DEMO_TRANSACTIONS = [
  // TELKOM — DANI (7)
  { id:"txd_t01", invoiceNumber:"INV-T-001", customerId:"cust_demo_t01", customerName:"Hilal Pratama",    barbermanId:"brb_dani",  branch:"Telkom", grandTotal:80000,  paymentMethod:"QRIS",     createdAt:"2026-10-01T09:00:00Z", services:[{name:"Special Service",price:80000,qty:1}] },
  { id:"txd_t02", invoiceNumber:"INV-T-002", customerId:"cust_demo_t02", customerName:"Fadlullah Fahmi",   barbermanId:"brb_dani",  branch:"Telkom", grandTotal:60000,  paymentMethod:"CASH",     createdAt:"2026-10-01T10:30:00Z", services:[{name:"Kids Haircut",price:60000,qty:1}] },
  { id:"txd_t03", invoiceNumber:"INV-T-003", customerId:"cust_demo_t03", customerName:"Nadhim Alamsyah",   barbermanId:"brb_dani",  branch:"Telkom", grandTotal:80000,  paymentMethod:"TRANSFER", createdAt:"2026-10-02T09:15:00Z", services:[{name:"Special Service",price:80000,qty:1}] },
  { id:"txd_t04", invoiceNumber:"INV-T-004", customerId:"cust_demo_t04", customerName:"Admu Ramadhan",     barbermanId:"brb_dani",  branch:"Telkom", grandTotal:55000,  paymentMethod:"CASH",     createdAt:"2026-10-02T11:00:00Z", services:[{name:"Special Service",price:80000,qty:1}] },
  { id:"txd_t05", invoiceNumber:"INV-T-005", customerId:"cust_demo_t05", customerName:"Rifky Aditya",      barbermanId:"brb_dani",  branch:"Telkom", grandTotal:80000,  paymentMethod:"QRIS",     createdAt:"2026-10-03T09:30:00Z", services:[{name:"Special Service",price:80000,qty:1}] },
  { id:"txd_t06", invoiceNumber:"INV-T-006", customerId:"cust_demo_t06", customerName:"Bagas Prasetyo",    barbermanId:"brb_dani",  branch:"Telkom", grandTotal:50000,  paymentMethod:"CASH",     createdAt:"2026-10-03T14:00:00Z", services:[{name:"Creambath",price:50000,qty:1}] },
  { id:"txd_t07", invoiceNumber:"INV-T-007", customerId:"cust_demo_t07", customerName:"Yusuf Habibi",      barbermanId:"brb_dani",  branch:"Telkom", grandTotal:80000,  paymentMethod:"DEBIT",    createdAt:"2026-10-04T08:30:00Z", services:[{name:"Special Service",price:80000,qty:1}] },
  // TELKOM — ARI (7)
  { id:"txd_t08", invoiceNumber:"INV-T-008", customerId:"cust_demo_t08", customerName:"Haris Munandar",    barbermanId:"brb_ari",   branch:"Telkom", grandTotal:80000,  paymentMethod:"CASH",     createdAt:"2026-10-01T09:00:00Z", services:[{name:"Special Service",price:80000,qty:1}] },
  { id:"txd_t09", invoiceNumber:"INV-T-009", customerId:"cust_demo_t09", customerName:"Alex Denhaq",       barbermanId:"brb_ari",   branch:"Telkom", grandTotal:60000,  paymentMethod:"QRIS",     createdAt:"2026-10-01T11:00:00Z", services:[{name:"Kids Haircut",price:60000,qty:1}] },
  { id:"txd_t10", invoiceNumber:"INV-T-010", customerId:"cust_demo_t10", customerName:"Dimas Setiawan",    barbermanId:"brb_ari",   branch:"Telkom", grandTotal:80000,  paymentMethod:"TRANSFER", createdAt:"2026-10-02T10:00:00Z", services:[{name:"Special Service",price:80000,qty:1}] },
  { id:"txd_t11", invoiceNumber:"INV-T-011", customerId:"cust_demo_t11", customerName:"Fikri Haikal",      barbermanId:"brb_ari",   branch:"Telkom", grandTotal:75000,  paymentMethod:"CASH",     createdAt:"2026-10-02T13:00:00Z", services:[{name:"Special Service",price:80000,qty:1}] },
  { id:"txd_t12", invoiceNumber:"INV-T-012", customerId:"cust_demo_t12", customerName:"Iqbal Tawakal",     barbermanId:"brb_ari",   branch:"Telkom", grandTotal:80000,  paymentMethod:"QRIS",     createdAt:"2026-10-03T10:00:00Z", services:[{name:"Special Service",price:80000,qty:1}] },
  { id:"txd_t13", invoiceNumber:"INV-T-013", customerId:"cust_demo_t13", customerName:"Aldi Taher",        barbermanId:"brb_ari",   branch:"Telkom", grandTotal:80000,  paymentMethod:"CASH",     createdAt:"2026-10-03T15:00:00Z", services:[{name:"Special Service",price:80000,qty:1}] },
  { id:"txd_t14", invoiceNumber:"INV-T-014", customerId:"cust_demo_t14", customerName:"Gilang Ramadhan",   barbermanId:"brb_ari",   branch:"Telkom", grandTotal:80000,  paymentMethod:"DEBIT",    createdAt:"2026-10-04T09:00:00Z", services:[{name:"Special Service",price:80000,qty:1}] },
  // TELKOM — AZIS (6)
  { id:"txd_t15", invoiceNumber:"INV-T-015", customerId:"cust_demo_t15", customerName:"Deva Narendra",     barbermanId:"brb_azis",  branch:"Telkom", grandTotal:80000,  paymentMethod:"CASH",     createdAt:"2026-10-01T10:00:00Z", services:[{name:"Special Service",price:80000,qty:1}] },
  { id:"txd_t16", invoiceNumber:"INV-T-016", customerId:"cust_demo_t16", customerName:"Avicena Novianto",  barbermanId:"brb_azis",  branch:"Telkom", grandTotal:50000,  paymentMethod:"QRIS",     createdAt:"2026-10-01T14:00:00Z", services:[{name:"Creambath",price:50000,qty:1}] },
  { id:"txd_t17", invoiceNumber:"INV-T-017", customerId:"cust_demo_t17", customerName:"Syamil Basalamah",  barbermanId:"brb_azis",  branch:"Telkom", grandTotal:80000,  paymentMethod:"TRANSFER", createdAt:"2026-10-02T09:00:00Z", services:[{name:"Special Service",price:80000,qty:1}] },
  { id:"txd_t18", invoiceNumber:"INV-T-018", customerId:"cust_demo_t18", customerName:"Kaniza Ardiansyah", barbermanId:"brb_azis",  branch:"Telkom", grandTotal:80000,  paymentMethod:"CASH",     createdAt:"2026-10-03T11:00:00Z", services:[{name:"Special Service",price:80000,qty:1}] },
  { id:"txd_t19", invoiceNumber:"INV-T-019", customerId:"cust_demo_t19", customerName:"Kevin Sanjaya",     barbermanId:"brb_azis",  branch:"Telkom", grandTotal:60000,  paymentMethod:"QRIS",     createdAt:"2026-10-03T13:00:00Z", services:[{name:"Kids Haircut",price:60000,qty:1}] },
  { id:"txd_t20", invoiceNumber:"INV-T-020", customerId:"cust_demo_t20", customerName:"Maulana Malik",     barbermanId:"brb_azis",  branch:"Telkom", grandTotal:80000,  paymentMethod:"CASH",     createdAt:"2026-10-04T10:00:00Z", services:[{name:"Special Service",price:80000,qty:1}] },
  // SUTA — ARIF (4)
  { id:"txd_s01", invoiceNumber:"INV-S-001", customerId:"cust_demo_s01", customerName:"Fajar Nugraha",     barbermanId:"brb_arif",  branch:"Suta",   grandTotal:80000,  paymentMethod:"CASH",     createdAt:"2026-10-01T09:30:00Z", services:[{name:"Special Service",price:80000,qty:1}] },
  { id:"txd_s02", invoiceNumber:"INV-S-002", customerId:"cust_demo_s02", customerName:"Erix Soekamti",     barbermanId:"brb_arif",  branch:"Suta",   grandTotal:60000,  paymentMethod:"QRIS",     createdAt:"2026-10-02T10:00:00Z", services:[{name:"Kids Haircut",price:60000,qty:1}] },
  { id:"txd_s03", invoiceNumber:"INV-S-003", customerId:"cust_demo_s03", customerName:"Galih Ginanjar",    barbermanId:"brb_arif",  branch:"Suta",   grandTotal:80000,  paymentMethod:"TRANSFER", createdAt:"2026-10-03T09:00:00Z", services:[{name:"Special Service",price:80000,qty:1}] },
  { id:"txd_s04", invoiceNumber:"INV-S-004", customerId:"cust_demo_s04", customerName:"Mian Tiarno",       barbermanId:"brb_arif",  branch:"Suta",   grandTotal:80000,  paymentMethod:"CASH",     createdAt:"2026-10-04T08:00:00Z", services:[{name:"Special Service",price:80000,qty:1}] },
  // SUTA — ADE (3)
  { id:"txd_s05", invoiceNumber:"INV-S-005", customerId:"cust_demo_s05", customerName:"Budi Hartono",      barbermanId:"brb_ade",   branch:"Suta",   grandTotal:50000,  paymentMethod:"CASH",     createdAt:"2026-10-01T11:00:00Z", services:[{name:"Creambath",price:50000,qty:1}] },
  { id:"txd_s06", invoiceNumber:"INV-S-006", customerId:"cust_demo_s06", customerName:"Rian D'Masiv",      barbermanId:"brb_ade",   branch:"Suta",   grandTotal:80000,  paymentMethod:"QRIS",     createdAt:"2026-10-02T13:00:00Z", services:[{name:"Special Service",price:80000,qty:1}] },
  { id:"txd_s07", invoiceNumber:"INV-S-007", customerId:"cust_demo_s07", customerName:"Bayu Skak",         barbermanId:"brb_ade",   branch:"Suta",   grandTotal:80000,  paymentMethod:"DEBIT",    createdAt:"2026-10-03T14:00:00Z", services:[{name:"Special Service",price:80000,qty:1}] },
  // SUTA — AKMAL (3)
  { id:"txd_s08", invoiceNumber:"INV-S-008", customerId:"cust_demo_s08", customerName:"Reza Rahadian",     barbermanId:"brb_akmal", branch:"Suta",   grandTotal:80000,  paymentMethod:"CASH",     createdAt:"2026-10-01T14:00:00Z", services:[{name:"Special Service",price:80000,qty:1}] },
  { id:"txd_s09", invoiceNumber:"INV-S-009", customerId:"cust_demo_s09", customerName:"Hendra Setiawan",   barbermanId:"brb_akmal", branch:"Suta",   grandTotal:60000,  paymentMethod:"QRIS",     createdAt:"2026-10-02T15:00:00Z", services:[{name:"Kids Haircut",price:60000,qty:1}] },
  { id:"txd_s10", invoiceNumber:"INV-S-010", customerId:"cust_demo_s10", customerName:"Deni Cagur",        barbermanId:"brb_akmal", branch:"Suta",   grandTotal:80000,  paymentMethod:"TRANSFER", createdAt:"2026-10-04T09:00:00Z", services:[{name:"Special Service",price:80000,qty:1}] },
];

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== "OWNER") {
      return NextResponse.json({ error: "Hanya OWNER yang bisa seed data demo" }, { status: 403 });
    }

    const dbUrl = process.env.DATABASE_URL || "";
    if (!dbUrl || dbUrl.includes("[YOUR-") || dbUrl.includes("placeholder")) {
      return NextResponse.json({ error: "DATABASE_URL belum dikonfigurasi" }, { status: 400 });
    }

    const results = { customers: 0, transactions: 0, items: 0, errors: [] as string[] };

    // 1. Upsert customers
    for (const c of DEMO_CUSTOMERS) {
      try {
        await prisma.customer.upsert({
          where: { id: c.id },
          update: { name: c.name, phone: c.phone, branch: c.branch },
          create: { id: c.id, name: c.name, phone: c.phone, branch: c.branch, totalVisits: 1, totalSpend: 80000 },
        });
        results.customers++;
      } catch (e: any) {
        results.errors.push(`customer ${c.id}: ${e.message}`);
      }
    }

    // 2. Upsert transactions + items + payments
    for (const tx of DEMO_TRANSACTIONS) {
      try {
        // Check if already exists
        const existing = await prisma.transaction.findUnique({ where: { id: tx.id } });
        if (existing) {
          results.transactions++;
          continue;
        }

        const subtotal = tx.grandTotal;
        const newTx = await prisma.transaction.create({
          data: {
            id: tx.id,
            invoiceNumber: tx.invoiceNumber,
            customerId: tx.customerId,
            customerName: tx.customerName,
            barbermanId: tx.barbermanId,
            branch: tx.branch,
            subtotal,
            discount: 0,
            grandTotal: tx.grandTotal,
            paymentMethod: tx.paymentMethod as any,
            paymentStatus: "PAID",
            notes: null,
            createdAt: new Date(tx.createdAt),
            updatedAt: new Date(tx.createdAt),
          },
        });

        // Create items
        for (const svc of tx.services) {
          await prisma.transactionItem.create({
            data: {
              transactionId: newTx.id,
              itemType: "SERVICE",
              serviceId: "srv_1",
              name: svc.name,
              price: svc.price,
              quantity: svc.qty,
              subtotal: svc.price * svc.qty,
            },
          }).catch(() => {});
        }

        // Create payment
        await prisma.payment.create({
          data: {
            transactionId: newTx.id,
            paymentMethod: tx.paymentMethod as any,
            amountPaid: tx.grandTotal,
            changeAmount: 0,
          },
        }).catch(() => {});

        results.transactions++;
        results.items += tx.services.length;
      } catch (e: any) {
        results.errors.push(`tx ${tx.id}: ${e.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `✅ Seeded ${results.customers} customers, ${results.transactions} transaksi, ${results.items} items ke Supabase`,
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET: cek berapa transaksi sudah ada
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const txCount = await prisma.transaction.count();
    const customerCount = await prisma.customer.count();
    const demoTxIds = DEMO_TRANSACTIONS.map(t => t.id);
    const existingDemo = await prisma.transaction.count({ where: { id: { in: demoTxIds } } });
    return NextResponse.json({ txCount, customerCount, demoTxExists: existingDemo, totalDemo: DEMO_TRANSACTIONS.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
