import prisma from "./prisma";
import bcrypt from "bcryptjs";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import fs from "fs";
import path from "path";

// Memory storage fallback jika PostgreSQL belum dikonfigurasi saat preview lokal
interface InMemoryDB {
  initialized: boolean;
  users: any[];
  barbermen: any[];
  services: any[];
  categories: any[];
  products: any[];
  stockMovements: any[];
  customers: any[];
  members: any[];
  bookings: any[];
  transactions: any[];
  transactionItems: any[];
  payments: any[];
  cashTransactions: any[];
  expenses: any[];
  transfers: any[];
  branchReports: any[];
  activities: any[];
  barberAssignments: any[];
  shopSettings: any;
}

const globalForDB = globalThis as unknown as {
  __ad_barbershop_memory_db?: InMemoryDB;
  __ad_barbershop_mtime?: number;
  dbStatus?: "unknown" | "connected" | "disconnected";
  lastCheckTime?: number;
  lastHydrateTime?: number;
};

if (!globalForDB.__ad_barbershop_memory_db) {
  globalForDB.__ad_barbershop_memory_db = {
    initialized: false,
    users: [],
    barbermen: [],
    services: [],
    categories: [],
    products: [],
    stockMovements: [],
    customers: [],
    members: [],
    bookings: [],
    transactions: [],
    transactionItems: [],
    payments: [],
    cashTransactions: [],
    expenses: [],
    transfers: [],
    branchReports: [],
    activities: [],
    barberAssignments: [],
    shopSettings: {
      id: "default",
      shopName: "AD BARBERSHOP",
      address: "Jl. Telekomunikasi No.234, Lengkong, Kec. Bojongsoang, Kabupaten Bandung, Jawa Barat 40287",
      phone: "0895-3267-09996",
      receiptHeader: "Classic Haircut & Professional Grooming",
      receiptFooter: "Terima Kasih Atas Kunjungan Anda! Tampil Lebih Percaya Diri Bersama AD Barbershop.",
      initialCashFloat: 100000,
      initialCashFloatTelkom: 100000,
      initialCashFloatSuta: 100000,
      bookingQrUrl: "/qris-ad-barbershop.png",
    },
  };
}


export const memoryDB: InMemoryDB = globalForDB.__ad_barbershop_memory_db;

export function getDbFilePath(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join("/tmp", "ad-barbershop-db.json");
  }
  return path.join(process.cwd(), "data", "local-db.json");
}

export function syncFromLocalDB(): void {
  // When a persistent database is configured, never let an ephemeral/local JSON
  // snapshot overwrite the authoritative Supabase state.
  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl && !dbUrl.includes("[YOUR-") && !dbUrl.includes("placeholder")) return;
  try {
    const filePath = getDbFilePath();
    if (!fs.existsSync(filePath)) {
      const bundled = path.join(process.cwd(), "data", "local-db.json");
      if (fs.existsSync(bundled)) {
        try {
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.copyFileSync(bundled, filePath);
        } catch {}
      }
    }

    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      if (!globalForDB.__ad_barbershop_mtime || stat.mtimeMs > globalForDB.__ad_barbershop_mtime) {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && parsed.initialized) {
          Object.assign(memoryDB, parsed);
          ensureRolesAndTransfers(memoryDB);
          globalForDB.__ad_barbershop_mtime = stat.mtimeMs;
        }
      }
    }
  } catch {
    // ignore
  }
}

export function ensureRolesAndTransfers(db: InMemoryDB) {
  if (!db.transfers) db.transfers = [];
  if (!db.branchReports) db.branchReports = [];
  if (!db.activities) db.activities = [];
  if (!db.barberAssignments) db.barberAssignments = [];
  if (!db.shopSettings) db.shopSettings = {};
  if (!db.shopSettings.bookingQrUrl) db.shopSettings.bookingQrUrl = "/qris-ad-barbershop.png";
  if (db.shopSettings.initialCashFloatTelkom === undefined) db.shopSettings.initialCashFloatTelkom = 100000;
  if (db.shopSettings.initialCashFloatSuta === undefined) db.shopSettings.initialCashFloatSuta = 100000;

  // Pastikan customer memiliki branch
  if (db.customers && Array.isArray(db.customers)) {
    for (const c of db.customers) {
      if (!c.branch) c.branch = "Telkom";
    }
  }

  // Pastikan 6 barberman memiliki homeBranch, workingBranch, dan status yang benar
  // PENTING: Jangan override workingBranch yang sudah tersimpan — hanya set default jika belum ada
  if (db.barbermen && Array.isArray(db.barbermen)) {
    const sutaBarberNames = ["ade", "arif", "akmal"];
    for (const b of db.barbermen) {
      const lower = (b.name || "").toLowerCase();
      // Set homeBranch hanya jika belum ada (tidak pernah di-override)
      if (!b.homeBranch) {
        b.homeBranch = sutaBarberNames.some((n) => lower.includes(n)) ? "Suta" : "Telkom";
      }
      // Set workingBranch hanya jika belum ada — JANGAN override nilai yang sudah tersimpan!
      if (!b.workingBranch) {
        b.workingBranch = b.branch || b.homeBranch;
      }
      // Sinkronkan branch dengan workingBranch (untuk kompatibilitas query lama)
      b.branch = b.workingBranch;
      // Hitung status dari nilai yang tersimpan (tidak memaksa reset)
      if (b.isActive === false) {
        b.status = "LIBUR";
      } else if (b.workingBranch !== b.homeBranch) {
        b.status = "DIPERBANTUKAN";
      } else {
        b.status = "AKTIF";
      }
    }
  }


  // Pastikan produk memiliki stok per cabang (Telkom & Suta)
  if (db.products && Array.isArray(db.products)) {
    for (const p of db.products) {
      if (p.stockTelkom === undefined || p.stockSuta === undefined) {
        const total = p.stock || 0;
        p.stockTelkom = Math.ceil(total / 2);
        p.stockSuta = Math.floor(total / 2);
        p.stock = (p.stockTelkom || 0) + (p.stockSuta || 0);
      }
    }
  }

  const defaultPasswordHash = "$2a$10$cS0SEMAI7ePLiuHs/VlGv.H0weDyjirNgwDGA16tWZewUErJADc7i"; // admin123
  const requiredUsers = [
    {
      id: "usr_owner",
      username: "owner",
      email: "owner@adbarbershop.com",
      passwordHash: defaultPasswordHash,
      name: "Owner AD Barbershop",
      role: "OWNER",
      branch: "All",
    },
    {
      id: "usr_admin_telkom",
      username: "admin_telkom",
      email: "telkom@adbarbershop.com",
      passwordHash: defaultPasswordHash,
      name: "Admin Telkom",
      role: "ADMIN_TELKOM",
      branch: "Telkom",
    },
    {
      id: "usr_admin_suta",
      username: "admin_suta",
      email: "suta@adbarbershop.com",
      passwordHash: defaultPasswordHash,
      name: "Admin Suta",
      role: "ADMIN_SUTA",
      branch: "Suta",
    },
  ];

  if (!db.users) db.users = [];
  for (const ru of requiredUsers) {
    if (!db.users.some((u) => u.username?.toLowerCase() === ru.username.toLowerCase())) {
      db.users.push(ru);
    }
  }

  // Hapus user 'admin' lama jika masih ada (tidak boleh login lagi)
  db.users = db.users.filter((u: any) => u.username?.toLowerCase() !== "admin");
}


// ─── ENSURE SUPABASE SCHEMA & SEED ──────────────────────────────────────────
// Jalan sekali per process: pastikan schema + data default ada di Supabase.
//
// 🔴 CRITICAL FIX (Vercel Serverless):
// Sebelumnya pakai globalThis.__ad_schema_ensured → reset setiap cold start Lambda baru.
// Sekarang pakai flag di shop_settings DB ("schemaVersion") → persist lintas Lambda instances.
// In-process cache tetap ada agar tidak query DB setiap request dalam warm Lambda.

const globalForSchema = globalThis as unknown as {
  __ad_schema_ensured?: boolean;
  __ad_schema_check_promise?: Promise<void>;
};

// Promise agar tidak ada 2 calls concurrent dalam 1 Lambda warm instance
let _schemaPromise: Promise<void> | null = null;

export async function ensureSupabaseSchema(): Promise<void> {
  // In-process fast path — same warm Lambda, already checked
  if (globalForSchema.__ad_schema_ensured) return;
  if (!process.env.DATABASE_URL) {
    globalForSchema.__ad_schema_ensured = true;
    return;
  }
  // Deduplicate concurrent calls in the same Lambda
  if (_schemaPromise) return _schemaPromise;
  _schemaPromise = _doEnsureSchema().finally(() => { _schemaPromise = null; });
  return _schemaPromise;
}

export async function seedDemoTransactionsToSupabase(): Promise<{ count: number }> {
  try {
    const dbPath = path.join(process.cwd(), "data", "local-db.json");
    if (!fs.existsSync(dbPath)) return { count: 0 };
    const localDB = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
    if (!localDB.transactions || localDB.transactions.length === 0) return { count: 0 };

    console.log(`🚀 [seedDemoTransactionsToSupabase] Batch menyinkronkan ${localDB.transactions.length} transaksi ke Supabase...`);

    // 1. Batch upsert customers
    const customerData = (localDB.customers || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      phone: c.phone || null,
      instagram: c.instagram || null,
      branch: c.branch || "Telkom",
      totalVisits: c.totalVisits || 1,
      totalSpend: c.totalSpend || 80000,
    }));
    await prisma.customer.createMany({ data: customerData, skipDuplicates: true }).catch(() => {});

    // 2. Batch insert transactions
    const validMethods = ["CASH", "QRIS", "TRANSFER", "DEBIT", "KREDIT", "E_WALLET"];
    const txData = localDB.transactions.map((tx: any) => ({
      id: tx.id,
      invoiceNumber: tx.invoiceNumber,
      customerId: tx.customerId || null,
      customerName: tx.customerName || "Customer",
      customerPhone: tx.customerPhone || null,
      customerInstagram: tx.instagram || tx.customerInstagram || null,
      barbermanId: tx.barbermanId,
      branch: tx.branch || "Telkom",
      subtotal: Number(tx.subtotal || tx.grandTotal || 0),
      discount: Number(tx.discount || 0),
      grandTotal: Number(tx.grandTotal || 0),
      paymentMethod: (validMethods.includes(tx.paymentMethod) ? tx.paymentMethod : "CASH") as any,
      paymentStatus: "PAID" as const,
      notes: tx.notes || null,
      createdAt: new Date(tx.createdAt),
      updatedAt: new Date(tx.updatedAt || tx.createdAt),
    }));
    await prisma.transaction.createMany({ data: txData, skipDuplicates: true }).catch(() => {});

    // 3. Batch insert items
    const itemData = (localDB.transactionItems || []).map((ti: any) => ({
      id: ti.id,
      transactionId: ti.transactionId,
      itemType: (ti.itemType === "PRODUCT" ? "PRODUCT" : "SERVICE") as any,
      serviceId: ti.serviceId || (ti.itemType === "PRODUCT" ? null : "srv_1"),
      productId: ti.productId || null,
      name: ti.name,
      price: Number(ti.price || 0),
      costPrice: Number(ti.costPrice || 0),
      quantity: Number(ti.quantity || 1),
      subtotal: Number(ti.subtotal || ti.price || 0),
    }));
    await prisma.transactionItem.createMany({ data: itemData, skipDuplicates: true }).catch(() => {});

    // 4. Batch insert payments
    const paymentData = (localDB.payments || []).map((p: any) => ({
      id: p.id,
      transactionId: p.transactionId,
      paymentMethod: (validMethods.includes(p.paymentMethod) ? p.paymentMethod : "CASH") as any,
      amountPaid: Number(p.amountPaid || p.amount || 0),
      changeAmount: Number(p.changeAmount || 0),
      paymentRef: p.paymentRef || null,
      createdAt: new Date(p.createdAt || Date.now()),
    }));
    await prisma.payment.createMany({ data: paymentData, skipDuplicates: true }).catch(() => {});

    // 5. Batch insert cash transactions
    const cashData = (localDB.cashTransactions || []).map((c: any) => ({
      id: c.id,
      type: c.type as any,
      category: c.category || "Operasional",
      amount: Number(c.amount || 0),
      description: c.description || "",
      source: c.source || "MANUAL",
      branch: c.branch || "All",
      createdAt: new Date(c.createdAt || Date.now()),
    }));
    await prisma.cashTransaction.createMany({ data: cashData, skipDuplicates: true }).catch(() => {});

    console.log(`✅ [seedDemoTransactionsToSupabase] Batch seed selesai dalam ~100ms (${txData.length} transaksi).`);
    return { count: txData.length };
  } catch (err: any) {
    console.error("⚠️ [seedDemoTransactionsToSupabase] error:", err?.message);
    return { count: 0 };
  }
}

async function _doEnsureSchema(): Promise<void> {
  try {
    // 🔑 Check DB flag first — already done by a previous Lambda instance?
    // We use shop_settings.receiptFooter as a version marker (no schema changes needed)
    // Actually: check a fast way — if users table has admin rows, schema is already set up.
    const existingUserCount = await prisma.user.count().catch(() => -1);
    if (existingUserCount > 0) {
      // Check if transactions need demo seed
      const txCount = await prisma.transaction.count().catch(() => -1);
      if (txCount === 0) {
        console.log("🌱 Menyemai data demo transaksi ke Supabase...");
        await seedDemoTransactionsToSupabase();
      }
      globalForSchema.__ad_schema_ensured = true;
      console.log("⚡ ensureSupabaseSchema: skip (DB already seeded, users=" + existingUserCount + ", tx=" + txCount + ")");
      return;
    }

    // First-time setup: run ALTER TABLE + seed
    console.log("🔧 ensureSupabaseSchema: first-time setup dimulai...");

    // 1. Tambah kolom branch + kolom baru jika belum ada
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "barbermen" ADD COLUMN IF NOT EXISTS "branch" TEXT NOT NULL DEFAULT 'Telkom'`); } catch {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "barbermen" ADD COLUMN IF NOT EXISTS "home_branch" TEXT NOT NULL DEFAULT 'Telkom'`); } catch {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "barbermen" ADD COLUMN IF NOT EXISTS "working_branch" TEXT NOT NULL DEFAULT 'Telkom'`); } catch {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "barbermen" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'AKTIF'`); } catch {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "branch" TEXT NOT NULL DEFAULT 'All'`); } catch {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "branch" TEXT DEFAULT 'Telkom'`); } catch {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "customer_instagram" TEXT`); } catch {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "cash_transactions" ADD COLUMN IF NOT EXISTS "branch" TEXT DEFAULT 'All'`); } catch {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "stock_telkom" INTEGER NOT NULL DEFAULT 0`); } catch {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "stock_suta" INTEGER NOT NULL DEFAULT 0`); } catch {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "branch" TEXT DEFAULT 'Telkom'`); } catch {}
    try { await prisma.$executeRawUnsafe(`UPDATE "customers" SET "branch" = 'Telkom' WHERE "branch" IS NULL`); } catch {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "instagram" TEXT`); } catch {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "address" TEXT`); } catch {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "notes" TEXT`); } catch {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "branch" TEXT DEFAULT 'Telkom'`); } catch {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "dp_amount" DOUBLE PRECISION DEFAULT 20000`); } catch {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "dp_status" TEXT DEFAULT 'SUDAH_DIBAYAR'`); } catch {}

    // 2. Users — selalu upsert (pastikan password & role selalu benar)
    const passwordHash = "$2a$10$cS0SEMAI7ePLiuHs/VlGv.H0weDyjirNgwDGA16tWZewUErJADc7i"; // admin123
    const defaultUsers = [
      { id: "usr_owner",        username: "owner",        email: "owner@adbarbershop.com",   passwordHash, name: "Owner AD Barbershop", role: "OWNER",        branch: "All"    },
      { id: "usr_admin_telkom", username: "admin_telkom", email: "telkom@adbarbershop.com",  passwordHash, name: "Admin Telkom",         role: "ADMIN_TELKOM", branch: "Telkom" },
      { id: "usr_admin_suta",   username: "admin_suta",   email: "suta@adbarbershop.com",    passwordHash, name: "Admin Suta",           role: "ADMIN_SUTA",   branch: "Suta"   },
    ];
    for (const u of defaultUsers) {
      try {
        await prisma.user.upsert({
          where: { username: u.username },
          update: { passwordHash: u.passwordHash, role: u.role as any, branch: u.branch },
          create: { ...u, role: u.role as any },
        });
      } catch {}
    }

    // 3. Barbermen — HANYA seed jika tabel kosong (jangan timpa data user)
    const barbermanCount = await prisma.barberman.count().catch(() => 0);
    if (barbermanCount === 0) {
      const defaultBarbermen = [
        { id: "brb_ari",   name: "Ari",   nickname: "Bang Ari",   phone: "081200004444", isActive: true, branch: "Telkom" },
        { id: "brb_dani",  name: "Dani",  nickname: "Bang Dani",  phone: "081255556666", isActive: true, branch: "Telkom" },
        { id: "brb_azis",  name: "Azis",  nickname: "Bang Azis",  phone: "081233334444", isActive: true, branch: "Telkom" },
        { id: "brb_ade",   name: "Ade",   nickname: "Bang Ade",   phone: "081200001111", isActive: true, branch: "Suta"   },
        { id: "brb_arif",  name: "Arif",  nickname: "Bang Arif",  phone: "081200002222", isActive: true, branch: "Suta"   },
        { id: "brb_akmal", name: "Akmal", nickname: "Bang Akmal", phone: "081200003333", isActive: true, branch: "Suta"   },
      ];
      for (const b of defaultBarbermen) {
        try { await prisma.barberman.create({ data: b }); } catch {}
      }
    }

    // 4. Services — hanya jika kosong
    const serviceCount = await prisma.service.count().catch(() => 0);
    if (serviceCount === 0) {
      const defaultServices = [
        { id: "srv_1", name: "Special Service",           category: "HAIRCUT",   price: 80000,  durationMinutes: 60, isActive: true },
        { id: "srv_2", name: "Creambath",                 category: "TREATMENT", price: 50000,  durationMinutes: 30, isActive: true },
        { id: "srv_3", name: "Kids Haircut",              category: "HAIRCUT",   price: 60000,  durationMinutes: 50, isActive: true },
        { id: "srv_4", name: "Ear Candle + Head Massage", category: "TREATMENT", price: 30000,  durationMinutes: 30, isActive: true },
        { id: "srv_5", name: "Black Mask",                category: "TREATMENT", price: 25000,  durationMinutes: 15, isActive: true },
        { id: "srv_6", name: "Hair Coloring (Basic)",     category: "COLORING",  price: 450000, durationMinutes: 60, isActive: true },
      ];
      for (const s of defaultServices) {
        try { await prisma.service.create({ data: s }); } catch {}
      }
    }

    // 5. Categories — hanya jika kosong
    const categoryCount = await prisma.productCategory.count().catch(() => 0);
    if (categoryCount === 0) {
      const cats = [
        { id: "cat_pomade",  name: "Pomade",  slug: "pomade",  description: "Minyak rambut styling pria" },
        { id: "cat_powder",  name: "Powder",  slug: "powder",  description: "Wax / powder styling" },
        { id: "cat_tonic",   name: "Tonic",   slug: "tonic",   description: "Tonik penyegar rambut" },
        { id: "cat_shampoo", name: "Shampoo", slug: "shampoo", description: "Sampo perawatan" },
      ];
      for (const c of cats) {
        try { await prisma.productCategory.create({ data: c }); } catch {}
      }
    }

    // 6. Products — hanya jika kosong
    const productCount = await prisma.product.count().catch(() => 0);
    if (productCount === 0) {
      const prods = [
        { id: "prd_smith_fine",      categoryId: "cat_pomade", sku: "POM-SMF-01", name: "Smith Fine Shine",                   costPrice: 30000,  sellingPrice: 130000, stock: 3, minStock: 3, unit: "sachet", isActive: true },
        { id: "prd_smith_prem",      categoryId: "cat_pomade", sku: "POM-SMP-02", name: "Smith Premium Medium",               costPrice: 30000,  sellingPrice: 130000, stock: 1, minStock: 3, unit: "sachet", isActive: true },
        { id: "prd_smith_bold",      categoryId: "cat_pomade", sku: "POM-SMB-03", name: "Smith Bold Hold",                    costPrice: 30000,  sellingPrice: 130000, stock: 2, minStock: 3, unit: "sachet", isActive: true },
        { id: "prd_paradox_grand",   categoryId: "cat_pomade", sku: "POM-PDG-04", name: "Paradox Clay Grandfather",           costPrice: 130000, sellingPrice: 160000, stock: 4, minStock: 2, unit: "sachet", isActive: true },
        { id: "prd_paradox_quant",   categoryId: "cat_pomade", sku: "POM-PDQ-05", name: "Paradox Clay Quantum",               costPrice: 130000, sellingPrice: 160000, stock: 0, minStock: 2, unit: "sachet", isActive: true },
        { id: "prd_hairmers_clay",   categoryId: "cat_pomade", sku: "POM-HMC-06", name: "Hairmers Clay",                     costPrice: 125000, sellingPrice: 160000, stock: 0, minStock: 2, unit: "sachet", isActive: true },
        { id: "prd_hairmers_pwd",    categoryId: "cat_powder", sku: "PWD-HMP-07", name: "Hairmers Powder",                   costPrice: 65000,  sellingPrice: 100000, stock: 0, minStock: 2, unit: "sachet", isActive: true },
        { id: "prd_smith_ocean",     categoryId: "cat_powder", sku: "PWD-SMO-08", name: "Smith Ocean Dust Powder",            costPrice: 65000,  sellingPrice: 100000, stock: 0, minStock: 2, unit: "sachet", isActive: true },
        { id: "prd_powder_paradox",  categoryId: "cat_powder", sku: "PWD-PPX-09", name: "Powder Paradox",                    costPrice: 65000,  sellingPrice: 100000, stock: 0, minStock: 2, unit: "sachet", isActive: true },
        { id: "prd_nobad_pwd",       categoryId: "cat_powder", sku: "PWD-NBH-10", name: "No Bad Hair Powder",                costPrice: 110000, sellingPrice: 195000, stock: 0, minStock: 2, unit: "sachet", isActive: true },
        { id: "prd_hairmers_paste",  categoryId: "cat_pomade", sku: "POM-HMP-11", name: "Hairmers Paste Kecil",              costPrice: 65000,  sellingPrice: 100000, stock: 0, minStock: 2, unit: "sachet", isActive: true },
        { id: "prd_hairmers_pro",    categoryId: "cat_pomade", sku: "POM-HPW-12", name: "Hairmers Pro Water Based Kecil",    costPrice: 55000,  sellingPrice: 100000, stock: 0, minStock: 2, unit: "sachet", isActive: true },
        { id: "prd_dream_oil_heavy", categoryId: "cat_pomade", sku: "POM-DOH-13", name: "Dream Pomade Oil Based Heavy Hold", costPrice: 70000,  sellingPrice: 110000, stock: 0, minStock: 2, unit: "sachet", isActive: true },
        { id: "prd_dream_oil_light", categoryId: "cat_pomade", sku: "POM-DOL-14", name: "Dream Pomade Oil Based Light Hold", costPrice: 80000,  sellingPrice: 120000, stock: 3, minStock: 2, unit: "sachet", isActive: true },
        { id: "prd_dream_wb_strong", categoryId: "cat_pomade", sku: "POM-DWS-15", name: "Dream Pomade WB Strong Hold",       costPrice: 80000,  sellingPrice: 120000, stock: 2, minStock: 2, unit: "sachet", isActive: true },
        { id: "prd_dream_wb_hyper",  categoryId: "cat_pomade", sku: "POM-DWH-16", name: "Dream Pomade WB Hyper Strong",      costPrice: 80000,  sellingPrice: 120000, stock: 0, minStock: 2, unit: "sachet", isActive: true },
        { id: "prd_puppet_wb",       categoryId: "cat_pomade", sku: "POM-PPW-17", name: "Puppet Pomade Waterbased",          costPrice: 85000,  sellingPrice: 130000, stock: 0, minStock: 2, unit: "sachet", isActive: true },
        { id: "prd_puppet_clay",     categoryId: "cat_pomade", sku: "POM-PPC-18", name: "Puppet Clay",                      costPrice: 100000, sellingPrice: 130000, stock: 0, minStock: 2, unit: "sachet", isActive: true },
        { id: "prd_freestyle_dust",  categoryId: "cat_powder", sku: "PWD-FSD-19", name: "Powder Free Style Dust",            costPrice: 75000,  sellingPrice: 110000, stock: 3, minStock: 3, unit: "sachet", isActive: true },
        { id: "prd_hairpro_dot",     categoryId: "cat_pomade", sku: "POM-HPD-20", name: "Hairpro Dot Clay",                  costPrice: 75000,  sellingPrice: 110000, stock: 1, minStock: 2, unit: "sachet", isActive: true },
        { id: "prd_hair_paste_new",  categoryId: "cat_pomade", sku: "POM-HPN-21", name: "Hair Paste New",                    costPrice: 75000,  sellingPrice: 110000, stock: 1, minStock: 2, unit: "sachet", isActive: true },
        { id: "prd_hairpro_wb_new",  categoryId: "cat_pomade", sku: "POM-HWN-22", name: "Hairpro Water Based New",           costPrice: 75000,  sellingPrice: 110000, stock: 2, minStock: 2, unit: "sachet", isActive: true },
        { id: "prd_puppet_murph",    categoryId: "cat_powder", sku: "PWD-PPM-23", name: "Powder Puppet Murpheus",            costPrice: 75000,  sellingPrice: 100000, stock: 0, minStock: 2, unit: "sachet", isActive: true },
      ];
      for (const p of prods) {
        try { await prisma.product.create({ data: p }); } catch {}
      }
    }

    console.log("✅ ensureSupabaseSchema: selesai");
  } catch (err: any) {
    console.warn("⚠️ ensureSupabaseSchema error:", err?.message);
  } finally {
    globalForSchema.__ad_schema_ensured = true;
  }
}

export function saveLocalDB() {
  try {
    const filePath = getDbFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(memoryDB, null, 2), "utf-8");
    if (fs.existsSync(filePath)) {
      globalForDB.__ad_barbershop_mtime = fs.statSync(filePath).mtimeMs;
    }
  } catch (err: any) {
    console.warn("⚠️ saveLocalDB error:", err?.message);
  }
}

export function loadLocalDB(): boolean {
  try {
    const filePath = getDbFilePath();
    if (!fs.existsSync(filePath)) {
      const bundled = path.join(process.cwd(), "data", "local-db.json");
      if (fs.existsSync(bundled)) {
        try {
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.copyFileSync(bundled, filePath);
        } catch {}
      }
    }

    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && parsed.initialized) {
        Object.assign(memoryDB, parsed);
        ensureRolesAndTransfers(memoryDB);
        globalForDB.__ad_barbershop_mtime = fs.statSync(filePath).mtimeMs;
        return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

export async function seedMemoryData(includeTransactions: boolean = true) {
  const passwordHash = await bcrypt.hash("admin123", 10);
  memoryDB.users = [
    {
      id: "usr_admin01",
      username: "admin",
      email: "admin@adbarbershop.com",
      passwordHash,
      name: "Owner AD Barbershop",
      role: "OWNER",
      branch: "All",
    },
    {
      id: "usr_owner",
      username: "owner",
      email: "owner@adbarbershop.com",
      passwordHash,
      name: "Owner AD Barbershop",
      role: "OWNER",
      branch: "All",
    },
    {
      id: "usr_admin_telkom",
      username: "admin_telkom",
      email: "telkom@adbarbershop.com",
      passwordHash,
      name: "Admin Telkom",
      role: "ADMIN_TELKOM",
      branch: "Telkom",
    },
    {
      id: "usr_admin_suta",
      username: "admin_suta",
      email: "suta@adbarbershop.com",
      passwordHash,
      name: "Admin Suta",
      role: "ADMIN_SUTA",
      branch: "Suta",
    },
  ];

  // ─── 6 Barberman Default ──────────────────────────────────────────
  // Telkom: Ari, Dani, Azis  |  Suta: Ade, Arif, Akmal
  // branch bisa berubah kapan saja (oper antar cabang) tapi ini default-nya
  memoryDB.barbermen = [
    { id: "brb_ari",   name: "Ari",   nickname: "Bang Ari",   phone: "081200004444", isActive: true, branch: "Telkom" },
    { id: "brb_dani",  name: "Dani",  nickname: "Bang Dani",  phone: "081255556666", isActive: true, branch: "Telkom" },
    { id: "brb_azis",  name: "Azis",  nickname: "Bang Azis",  phone: "081233334444", isActive: true, branch: "Telkom" },
    { id: "brb_ade",   name: "Ade",   nickname: "Bang Ade",   phone: "081200001111", isActive: true, branch: "Suta"   },
    { id: "brb_arif",  name: "Arif",  nickname: "Bang Arif",  phone: "081200002222", isActive: true, branch: "Suta"   },
    { id: "brb_akmal", name: "Akmal", nickname: "Bang Akmal", phone: "081200003333", isActive: true, branch: "Suta"   },
  ];


  memoryDB.services = [
    { id: "srv_haircut_classic", name: "Classic Haircut", category: "HAIRCUT", price: 40000, durationMinutes: 30, isActive: true },
    { id: "srv_haircut_premium", name: "Premium Haircut (Wash + Massage)", category: "HAIRCUT", price: 60000, durationMinutes: 45, isActive: true },
    { id: "srv_kids_haircut", name: "Kids Haircut", category: "HAIRCUT", price: 35000, durationMinutes: 25, isActive: true },
    { id: "srv_beard_trim", name: "Beard Trim & Hot Towel Shave", category: "SHAVE", price: 25000, durationMinutes: 20, isActive: true },
    { id: "srv_hair_spa", name: "Hair Spa & Creambath", category: "TREATMENT", price: 75000, durationMinutes: 40, isActive: true },
    { id: "srv_hair_coloring", name: "Hair Coloring (Basic Black/Brown)", category: "COLORING", price: 120000, durationMinutes: 60, isActive: true },
  ];

  memoryDB.categories = [
    { id: "cat_pomade", name: "Pomade", slug: "pomade", description: "Minyak rambut styling pria" },
    { id: "cat_tonic", name: "Tonic", slug: "tonic", description: "Tonik penyegar akar rambut" },
    { id: "cat_powder", name: "Powder", slug: "powder", description: "Styling powder bervolume" },
    { id: "cat_shampoo", name: "Shampoo", slug: "shampoo", description: "Shampoo perawatan kulit kepala" },
    { id: "cat_hair_clay", name: "Hair Clay", slug: "hair-clay", description: "Clay styling matte" },
    { id: "cat_hair_spray", name: "Hair Spray", slug: "hair-spray", description: "Spray pengunci rambut" },
  ];

  memoryDB.products = [
    { id: "prd_pomade_01", categoryId: "cat_pomade", sku: "POM-SUV-01", name: "Suavecito Matte Pomade 4oz", costPrice: 85000, sellingPrice: 130000, stock: 24, minStock: 5, unit: "pot", isActive: true },
    { id: "prd_pomade_02", categoryId: "cat_pomade", sku: "POM-CHF-02", name: "Chief Solid Black Pomade 4.2oz", costPrice: 90000, sellingPrice: 145000, stock: 18, minStock: 5, unit: "pot", isActive: true },
    { id: "prd_pomade_03", categoryId: "cat_pomade", sku: "POM-MRY-03", name: "Murrays Superior Pomade 3oz", costPrice: 55000, sellingPrice: 85000, stock: 12, minStock: 4, unit: "pot", isActive: true },
    { id: "prd_pomade_04", categoryId: "cat_pomade", sku: "POM-GTS-04", name: "Gatsby Styling Pomade Perfect Hold", costPrice: 25000, sellingPrice: 40000, stock: 30, minStock: 8, unit: "pot", isActive: true },
    { id: "prd_tonic_01", categoryId: "cat_tonic", sku: "TON-HRB-01", name: "Hair Tonic Herbal Ginseng 200ml", costPrice: 35000, sellingPrice: 60000, stock: 16, minStock: 5, unit: "botol", isActive: true },
    { id: "prd_tonic_02", categoryId: "cat_tonic", sku: "TON-MNT-02", name: "Menthol Cool Refreshing Hair Tonic 250ml", costPrice: 30000, sellingPrice: 55000, stock: 20, minStock: 5, unit: "botol", isActive: true },
    { id: "prd_powder_01", categoryId: "cat_powder", sku: "PWD-DST-01", name: "Dust It Texture Hair Styling Powder 10g", costPrice: 45000, sellingPrice: 80000, stock: 22, minStock: 5, unit: "botol", isActive: true },
    { id: "prd_powder_02", categoryId: "cat_powder", sku: "PWD-MAT-02", name: "Matte Volume Powder Hold Extra 15g", costPrice: 40000, sellingPrice: 75000, stock: 14, minStock: 5, unit: "botol", isActive: true },
    { id: "prd_shampoo_01", categoryId: "cat_shampoo", sku: "SHM-DAN-01", name: "Anti-Dandruff Barbershop Shampoo 300ml", costPrice: 35000, sellingPrice: 65000, stock: 3, minStock: 5, unit: "botol", isActive: true },
  ];

  memoryDB.stockMovements = [];
  memoryDB.payments = [];
  memoryDB.transactions = [];
  memoryDB.transactionItems = [];

  if (includeTransactions) {
    memoryDB.customers = [
      { id: "cst_01", name: "Budi", phone: null, instagram: null, branch: "Telkom", totalVisits: 4, totalSpend: 160000, lastVisitAt: new Date(), favoriteBarbermanId: "brb_arie", createdAt: new Date() },
      { id: "cst_02", name: "Rudi Haryanto", phone: "081234567890", instagram: null, branch: "Telkom", totalVisits: 5, totalSpend: 260000, lastVisitAt: subDays(new Date(), 1), favoriteBarbermanId: "brb_dani", createdAt: new Date() },
      { id: "cst_03", name: "Dimas", phone: null, instagram: "@dimas_barber", branch: "Suta", totalVisits: 3, totalSpend: 195000, lastVisitAt: subDays(new Date(), 2), favoriteBarbermanId: "brb_azis", createdAt: new Date() },
      { id: "cst_04", name: "Rizky Ramadhan", phone: "081298765432", instagram: "@rizky_ramadhan", branch: "Telkom", totalVisits: 8, totalSpend: 480000, lastVisitAt: new Date(), favoriteBarbermanId: "brb_arie", createdAt: new Date() },
      { id: "cst_05", name: "Kevin Sanjaya", phone: "085711223344", instagram: "@kevinsanjaya", branch: "Telkom", totalVisits: 6, totalSpend: 410000, lastVisitAt: new Date(), favoriteBarbermanId: "brb_dani", createdAt: new Date() },
    ];

  memoryDB.members = [
    {
      id: "mbr_01",
      customerId: "cst_04",
      memberCode: "AD-MBR-001",
      name: "Rizky Ramadhan",
      phone: "081298765432",
      packageName: "VIP Barbershop 6 Bulan",
      startDate: subDays(new Date(), 30),
      endDate: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000),
      status: "ACTIVE",
      totalVisits: 8,
      totalSpend: 480000,
    },
    {
      id: "mbr_02",
      customerId: "cst_05",
      memberCode: "AD-MBR-002",
      name: "Kevin Sanjaya",
      phone: "085711223344",
      packageName: "Gold Barbershop 3 Bulan",
      startDate: subDays(new Date(), 10),
      endDate: new Date(Date.now() + 80 * 24 * 60 * 60 * 1000),
      status: "ACTIVE",
      totalVisits: 6,
      totalSpend: 410000,
    },
  ];

  memoryDB.bookings = [
    { id: "bkg_01", customerId: "cst_04", customerName: "Rizky Ramadhan", customerPhone: "081298765432", barbermanId: "brb_arie", serviceId: "srv_haircut_premium", bookingDate: new Date(), bookingTime: "10:00", notes: "Potong rambut + cuci", status: "COMPLETED" },
    { id: "bkg_02", customerId: "cst_05", customerName: "Kevin Sanjaya", customerPhone: "085711223344", barbermanId: "brb_dani", serviceId: "srv_haircut_classic", bookingDate: new Date(), bookingTime: "11:30", notes: "Fade taper rapi", status: "COMPLETED" },
    { id: "bkg_03", customerId: "cst_02", customerName: "Rudi Haryanto", customerPhone: "081234567890", barbermanId: "brb_azis", serviceId: "srv_beard_trim", bookingDate: new Date(), bookingTime: "14:00", notes: "Merapikan kumis/jenggot", status: "ARRIVED" },
    { id: "bkg_04", customerId: null, customerName: "Farhan Maulana", customerPhone: "081399887766", barbermanId: "brb_arie", serviceId: "srv_haircut_classic", bookingDate: new Date(), bookingTime: "16:00", notes: "Customer baru", status: "CONFIRMED" },
  ];

  // Demo Transaksi Hari Ini sesuai contoh prompt:
  // Arie: 12 customer, 12 transaksi, Rp 480.000
  // Azis: 9 customer, 9 transaksi, Rp 360.000
  // Dani: 15 customer, 15 transaksi, Rp 600.000
  const today = new Date();
  
  // Arie transactions (12 items)
  for (let i = 1; i <= 12; i++) {
    const txId = `tx_arie_${i}`;
    const isPomade = i === 3;
    const grandTotal = isPomade ? 40000 + 130000 : 40000;
    memoryDB.transactions.push({
      id: txId,
      invoiceNumber: `AD-${format(today, "yyyyMMdd")}-A${String(i).padStart(3, "0")}`,
      customerId: "cst_04",
      customerName: i === 1 ? "Budi" : `Pelanggan Arie #${i}`,
      customerPhone: i === 1 ? null : `08123456${String(i).padStart(4, "0")}`,
      customerInstagram: i === 1 ? null : null,
      barbermanId: "brb_arie",
      subtotal: grandTotal,
      discount: 0,
      grandTotal,
      paymentMethod: i % 2 === 0 ? "QRIS" : "CASH",
      paymentStatus: "PAID",
      notes: "Transaksi Kasir",
      createdAt: new Date(today.setHours(9 + (i % 8), (i * 15) % 60)),
    });
    memoryDB.transactionItems.push({
      id: `txi_arie_${i}_1`,
      transactionId: txId,
      itemType: "SERVICE",
      serviceId: "srv_haircut_classic",
      productId: null,
      name: "Classic Haircut",
      price: 40000,
      costPrice: 0,
      quantity: 1,
      subtotal: 40000,
    });
    if (isPomade) {
      memoryDB.transactionItems.push({
        id: `txi_arie_${i}_2`,
        transactionId: txId,
        itemType: "PRODUCT",
        serviceId: null,
        productId: "prd_pomade_01",
        name: "Suavecito Matte Pomade 4oz",
        price: 130000,
        costPrice: 85000,
        quantity: 1,
        subtotal: 130000,
      });
    }
  }

  // Azis transactions (9 items)
  for (let i = 1; i <= 9; i++) {
    const txId = `tx_azis_${i}`;
    memoryDB.transactions.push({
      id: txId,
      invoiceNumber: `AD-${format(today, "yyyyMMdd")}-Z${String(i).padStart(3, "0")}`,
      customerId: "cst_03",
      customerName: i === 1 ? "Dimas" : `Pelanggan Azis #${i}`,
      customerPhone: null,
      customerInstagram: i === 1 ? "@dimas_barber" : null,
      barbermanId: "brb_azis",
      subtotal: 40000,
      discount: 0,
      grandTotal: 40000,
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      notes: "Transaksi Kasir",
      createdAt: new Date(today.setHours(10 + (i % 7), (i * 18) % 60)),
    });
    memoryDB.transactionItems.push({
      id: `txi_azis_${i}_1`,
      transactionId: txId,
      itemType: "SERVICE",
      serviceId: "srv_haircut_classic",
      productId: null,
      name: "Classic Haircut",
      price: 40000,
      costPrice: 0,
      quantity: 1,
      subtotal: 40000,
    });
  }

  // Dani transactions (15 items)
  for (let i = 1; i <= 15; i++) {
    const txId = `tx_dani_${i}`;
    memoryDB.transactions.push({
      id: txId,
      invoiceNumber: `AD-${format(today, "yyyyMMdd")}-D${String(i).padStart(3, "0")}`,
      customerId: "cst_02",
      customerName: i === 1 ? "Rudi Haryanto" : `Pelanggan Dani #${i}`,
      customerPhone: i === 1 ? "081234567890" : null,
      customerInstagram: null,
      barbermanId: "brb_dani",
      subtotal: 40000,
      discount: 0,
      grandTotal: 40000,
      paymentMethod: i % 3 === 0 ? "TRANSFER" : "CASH",
      paymentStatus: "PAID",
      notes: "Transaksi Kasir",
      createdAt: new Date(today.setHours(9 + (i % 9), (i * 12) % 60)),
    });
    memoryDB.transactionItems.push({
      id: `txi_dani_${i}_1`,
      transactionId: txId,
      itemType: "SERVICE",
      serviceId: "srv_haircut_classic",
      productId: null,
      name: "Classic Haircut",
      price: 40000,
      costPrice: 0,
      quantity: 1,
      subtotal: 40000,
    });
  }

  // Cash Ledger
  memoryDB.cashTransactions = [
    {
      id: "csh_init",
      type: "CASH_IN",
      category: "Modal Awal",
      amount: 100000,
      description: "Kas float awal laci kasir hari ini",
      source: "MANUAL_IN",
      createdAt: new Date(new Date().setHours(8, 0, 0)),
    },
    {
      id: "csh_sale_today",
      type: "CASH_IN",
      category: "Penjualan Kasir",
      amount: 880000,
      description: "Total akumulasi pembayaran cash hari ini",
      source: "POS_SALE",
      createdAt: new Date(new Date().setHours(13, 0, 0)),
    },
    {
      id: "csh_exp_1",
      type: "CASH_OUT",
      category: "Operasional Toko",
      amount: 75000,
      description: "Beli air galon & tisu leher barbershop",
      source: "EXPENSE",
      createdAt: new Date(new Date().setHours(11, 30, 0)),
    },
    {
      id: "csh_exp_2",
      type: "CASH_OUT",
      category: "Pembelian Stok",
      amount: 150000,
      description: "Beli silet razor & alkohol sterilisasi",
      source: "STOCK_PURCHASE",
      createdAt: new Date(new Date().setHours(14, 0, 0)),
    },
  ];
  } else {
    memoryDB.customers = [];
    memoryDB.members = [];
    memoryDB.bookings = [];
    memoryDB.transactions = [];
    memoryDB.transactionItems = [];
    const currentFloat = typeof memoryDB.shopSettings?.initialCashFloat === "number" ? memoryDB.shopSettings.initialCashFloat : 100000;
    memoryDB.cashTransactions = currentFloat > 0 ? [
      {
        id: "csh_init",
        type: "CASH_IN",
        category: "Modal Awal",
        amount: currentFloat,
        description: "Kas float modal awal laci kasir",
        source: "MANUAL_IN",
        createdAt: new Date(),
      },
    ] : [];
  }

  memoryDB.initialized = true;
  saveLocalDB();
}


// ─── HYDRATE MEMORYD FROM SUPABASE ───────────────────────────────────────────
// Dijalankan saat container Vercel baru naik, jika Supabase tersambung.
// Ini KUNCI perbaikan "data hilang": semua container baca data dari Supabase,
// bukan dari /tmp (ephemeral per-container) atau bundled local-db.json (kosong).
export async function hydrateFromSupabase(): Promise<void> {
  try {
    const [
      users, barbermen, services, products, categories,
      customers, members, bookings, transactions, cashTransactions,
    ] = await Promise.all([
      prisma.user.findMany().catch(() => [] as any[]),
      prisma.barberman.findMany().catch(() => [] as any[]),
      prisma.service.findMany().catch(() => [] as any[]),
      prisma.product.findMany().catch(() => [] as any[]),
      prisma.productCategory.findMany().catch(() => [] as any[]),
      prisma.customer.findMany().catch(() => [] as any[]),
      prisma.member.findMany().catch(() => [] as any[]),
      prisma.booking.findMany().catch(() => [] as any[]),
      prisma.transaction.findMany({
        orderBy: { createdAt: "desc" },
        include: { items: true, payments: true },
      }).catch(() => [] as any[]),
      prisma.cashTransaction.findMany({ orderBy: { createdAt: "desc" } }).catch(() => [] as any[]),
    ]);

    // Database is authoritative. Always replace memory snapshots, including empty arrays.
    memoryDB.users = users;
    {
      memoryDB.barbermen = barbermen.map((b: any) => ({
        ...b,
        homeBranch: b.homeBranch || b.home_branch || b.branch || "Telkom",
        workingBranch: b.workingBranch || b.working_branch || b.branch || "Telkom",
        status: b.status || "AKTIF",
      }));
    }
    memoryDB.services = services;
    {
      memoryDB.products = products.map((p: any) => ({
        ...p,
        stockTelkom: p.stockTelkom ?? Math.ceil((p.stock || 0) / 2),
        stockSuta: p.stockSuta ?? Math.floor((p.stock || 0) / 2),
      }));
    try {
      const branchStocks: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, stock, stock_telkom, stock_suta FROM "products"`
      );
      const byId = new Map(branchStocks.map((r: any) => [r.id, r]));
      memoryDB.products = memoryDB.products.map((p: any) => {
        const row: any = byId.get(p.id);
        return row
          ? { ...p, stock: Number(row.stock ?? p.stock ?? 0), stockTelkom: Number(row.stock_telkom ?? 0), stockSuta: Number(row.stock_suta ?? 0) }
          : p;
      });
    } catch (stockErr: any) {
      console.warn("⚠️ [hydrateFromSupabase] branch stock hydrate:", stockErr?.message);
    }
    }
    memoryDB.categories = categories;
    memoryDB.customers = customers.map((c: any) => ({
      ...c,
      branch: c.branch || "Telkom",
    }));
    memoryDB.members = members;
    memoryDB.bookings = bookings;
    {
      memoryDB.transactions = transactions.map((t: any) => ({
        ...t,
        branch: t.branch || "Telkom",
      }));
      const allItems: any[] = [];
      const allPayments: any[] = [];
      for (const t of transactions) {
        if (Array.isArray(t.items)) {
          for (const item of t.items) allItems.push(item);
        }
        if (Array.isArray(t.payments)) {
          for (const p of t.payments) allPayments.push(p);
        }
      }
      memoryDB.transactionItems = allItems;
      memoryDB.payments = allPayments;
    }
    memoryDB.cashTransactions = cashTransactions;

    // Shop settings
    const settings = await prisma.shopSetting.findFirst().catch(() => null);
    if (settings) {
      memoryDB.shopSettings = {
        ...memoryDB.shopSettings,
        ...settings,
        initialCashFloatTelkom: (settings as any).initialCashFloatTelkom || settings.initialCashFloat || 100000,
        initialCashFloatSuta: (settings as any).initialCashFloatSuta || settings.initialCashFloat || 100000,
        bookingQrUrl: (memoryDB.shopSettings as any)?.bookingQrUrl || "/qris-ad-barbershop.png",
      };
    }

    ensureRolesAndTransfers(memoryDB);
    globalForDB.lastHydrateTime = Date.now();
    console.log(
      `✅ [hydrateFromSupabase] berhasil: ${users.length} users, ${barbermen.length} barbermen, ` +
      `${transactions.length} transaksi, ${customers.length} customers, ${bookings.length} bookings`
    );
  } catch (err: any) {
    console.warn("⚠️ [hydrateFromSupabase] error:", err?.message);
    throw err;
  }
}

export async function initMemoryDBIfNeeded() {
  const dbUrl = process.env.DATABASE_URL || "";
  const hasPersistentDb = !!dbUrl && !dbUrl.includes("[YOUR-") && !dbUrl.includes("placeholder");

  // 🔴 CRITICAL FIX (Vercel Serverless):
  // Sebelumnya: setiap request memanggil hydrateFromSupabase() (fetch SEMUA data → lambat)
  // Sekarang: di mode Supabase, API functions query Prisma LANGSUNG — memory DB tidak diperlukan.
  // ensureSupabaseSchema() dipanggil sekali saja (in-process cache + DB count check).
  if (hasPersistentDb) {
    // Hanya jalankan schema check sekali (fast: hanya 1 COUNT query jika sudah done)
    await ensureSupabaseSchema();
    memoryDB.initialized = true;
    return;
  }

  // Local development without DATABASE_URL keeps the existing file-backed demo mode.
  syncFromLocalDB();
  if (memoryDB.initialized) return;
  const loadedFromDisk = loadLocalDB();
  if (loadedFromDisk) {
    memoryDB.initialized = true;
    return;
  }
  await seedMemoryData(false);
}


export async function resetDatabase(mode: "demo" | "clean" = "demo") {
  const connected = await isDatabaseConnected();
  if (connected) {
    try {
      await prisma.transactionItem.deleteMany({});
      await prisma.payment.deleteMany({});
      await prisma.transaction.deleteMany({});
      await prisma.cashTransaction.deleteMany({});
      await prisma.stockMovement.deleteMany({});
      await prisma.booking.deleteMany({});
      await prisma.member.deleteMany({});
      if (mode === "clean") {
        await prisma.customer.deleteMany({});
        const settings = await prisma.shopSetting.findUnique({ where: { id: "default" } });
        const floatVal = settings?.initialCashFloat ?? 100000;
        if (floatVal > 0) {
          await prisma.cashTransaction.create({
            data: {
              type: "CASH_IN",
              category: "Modal Awal",
              amount: floatVal,
              description: "Kas float modal awal laci kasir",
              source: "MANUAL_IN",
            },
          });
        }
      } else {
        // Mode demo: Semai 30 transaksi demo (20 Telkom + 10 Suta) ke Supabase!
        await seedDemoTransactionsToSupabase();
      }
    } catch (e) {
      console.warn("Prisma clean tables:", e);
    }
  }

  await seedMemoryData(mode === "demo");
  saveLocalDB();
  return { success: true, mode };
}

let dbStatus: "unknown" | "connected" | "disconnected" = "unknown";
let lastCheckTime = 0;
let lastDbError: string | null = null;

export async function isDatabaseConnected(): Promise<boolean> {
  const now = Date.now();
  if (dbStatus !== "unknown" && now - lastCheckTime < 60000) {
    return dbStatus === "connected";
  }

  const dbUrl = process.env.DATABASE_URL || "";
  if (!dbUrl || dbUrl.includes("localhost:5432") || dbUrl.includes("placeholder") || dbUrl.includes("[YOUR-")) {
    try {
      const probe = prisma.shopSetting.findFirst({ select: { id: true } });
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("DB Timeout (300ms)")), 300));
      await Promise.race([probe, timeout]);
      dbStatus = "connected";
      lastDbError = null;
    } catch (err: any) {
      dbStatus = "disconnected";
      lastDbError = dbUrl.includes("[YOUR-")
        ? "Password DATABASE_URL masih berisi '[YOUR-PASSWORD]'. Harap ganti dengan password Supabase Anda."
        : (!dbUrl ? "DATABASE_URL belum diatur di Environment Variables Vercel." : (err?.message || "Tidak dapat terhubung ke database lokal."));
    }
  } else {
    try {
      // Gunakan query model Prisma, bukan raw query, untuk menghindari tabrakan named prepared statement di PgBouncer
      const probe = prisma.shopSetting.findFirst({ select: { id: true } }).catch(async (e: any) => {
        // Jika tabel belum di-migrate, tangkap error table not found (Postgres tetap terhubung)
        if (e?.code === "P2021" || e?.message?.includes("does not exist")) {
          return null;
        }
        throw e;
      });
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("DB Connection Timeout (7s)")), 7000));
      await Promise.race([probe, timeout]);
      dbStatus = "connected";
      lastDbError = null;
    } catch (err: any) {
      if (err?.message?.includes("prepared statement") || err?.code === "42P05") {
        dbStatus = "connected";
        lastDbError = null;
      } else {
        dbStatus = "disconnected";
        lastDbError = err?.message || String(err);
        console.error("⚠️ [Prisma DB Probe Failed]:", lastDbError);
      }
    }
  }

  lastCheckTime = now;
  return dbStatus === "connected";
}

export async function getDatabaseDiagnostics() {
  const dbUrl = process.env.DATABASE_URL || "";
  const isDirectSupabase = dbUrl.includes("db.") && dbUrl.includes(".supabase.co");
  const isPooler = dbUrl.includes("pooler.supabase.com") || dbUrl.includes(":6543");
  const hasPlaceholder = dbUrl.includes("[YOUR-") || dbUrl.includes("placeholder");

  // Force fresh probe
  lastCheckTime = 0;
  dbStatus = "unknown";
  const connected = await isDatabaseConnected();

  let tableCounts: any = null;
  if (connected) {
    try {
      const [users, barbermen, services, products, transactions] = await Promise.all([
        prisma.user.count(),
        prisma.barberman.count(),
        prisma.service.count(),
        prisma.product.count(),
        prisma.transaction.count(),
      ]);
      tableCounts = { users, barbermen, services, products, transactions };
    } catch (e: any) {
      lastDbError = `Query tabel gagal: ${e.message}`;
    }
  }

  let warning: string | null = null;
  if (!dbUrl) {
    warning = "DATABASE_URL belum dipasang di Vercel Environment Variables.";
  } else if (hasPlaceholder) {
    warning = "Password database masih berupa '[YOUR-PASSWORD]'. Silakan ganti dengan password asli database Supabase Anda.";
  } else if (isDirectSupabase) {
    warning = "Anda menggunakan Direct Connection string (db.xxx.supabase.co:5432). Vercel Serverless TIDAK mendukung IPv6 sehingga koneksi selalu gagal (timeout/unreachable). Anda HARUS mengganti DATABASE_URL di Vercel dengan Connection Pooler string dari Supabase (port 6543).";
  } else if (isPooler && !dbUrl.includes("pgbouncer=true")) {
    warning = "Disarankan menambahkan '?pgbouncer=true' di akhir DATABASE_URL Anda di Vercel agar koneksi pooler selalu stabil tanpa bentrok prepared statement.";
  }

  return {
    connected,
    status: connected ? "CONNECTED_TO_SUPABASE" : "FALLBACK_IN_MEMORY",
    isConfigured: !!dbUrl,
    connectionType: isPooler ? "Supabase Pooler (IPv4 - Recommended)" : isDirectSupabase ? "Supabase Direct (IPv6 - Incompatible with Vercel)" : "Custom/Local",
    warning,
    lastError: lastDbError,
    tableCounts,
  };
}

// Helper untuk sinkronisasi database:
// memoryDB + local-db.json adalah SUMBER KEBENARAN UTAMA (Single Source of Truth) aplikasi.
// Seluruh data transaksi, mutasi kas, stok cabang, barberman, booking, dan customer
// selalu tersimpan permanen di disk (local-db.json) dan konsisten di seluruh halaman.
// Prisma digunakan sebagai background sync / backup bila koneksi database tersedia.
export async function safeDb<T>(
  prismaFn: () => Promise<T>,
  memoryFn: () => Promise<any> | any,
  isMutation: boolean = false
): Promise<T> {
  const dbUrl = process.env.DATABASE_URL || "";
  const hasPersistentDb = !!dbUrl && !dbUrl.includes("[YOUR-") && !dbUrl.includes("placeholder");

  if (hasPersistentDb) {
    // Eksekusi query Prisma langsung (cepat, tanpa probe lambat atau fetch 10 tabel)
    return await prismaFn();
  }

  // Local-only fallback when no persistent database is configured.
  await initMemoryDBIfNeeded();
  syncFromLocalDB();
  const result = await memoryFn();
  if (isMutation) saveLocalDB();
  return result as T;
}


export async function autoSeedSupabaseDatabase() {
  try {
    // 1. Shop Setting
    await prisma.shopSetting.upsert({
      where: { id: "default" },
      update: {},
      create: {
        id: "default",
        shopName: "AD BARBERSHOP",
        address: "Jl. Telekomunikasi No.234, Lengkong, Kec. Bojongsoang, Kabupaten Bandung, Jawa Barat 40287",
        phone: "0895-3267-09996",
        receiptHeader: "Classic Haircut & Professional Grooming",
        receiptFooter: "Terima Kasih Atas Kunjungan Anda! Tampil Lebih Percaya Diri Bersama AD Barbershop.",
        initialCashFloat: 100000,
      },
    });

    // 2. Admin Users (3 Role)
    const passwordHash = "$2a$10$cS0SEMAI7ePLiuHs/VlGv.H0weDyjirNgwDGA16tWZewUErJADc7i"; // admin123
    const defaultUsers = [
      { id: "usr_owner",        username: "owner",       email: "owner@adbarbershop.com",  passwordHash, name: "Owner AD Barbershop", role: "OWNER",        branch: "All"    },
      { id: "usr_admin_telkom", username: "admin_telkom", email: "telkom@adbarbershop.com", passwordHash, name: "Admin Telkom",         role: "ADMIN_TELKOM", branch: "Telkom" },
      { id: "usr_admin_suta",   username: "admin_suta",   email: "suta@adbarbershop.com",   passwordHash, name: "Admin Suta",           role: "ADMIN_SUTA",   branch: "Suta"   },
    ];

    for (const u of defaultUsers) {
      try {
        await prisma.user.upsert({
          where: { username: u.username },
          update: { passwordHash: u.passwordHash, role: u.role as any, branch: u.branch },
          create: { ...u, role: u.role as any },
        });
      } catch (err) {
        console.warn(`Gagal seed user ${u.username}`, err);
      }
    }

    // 3. Barbermen — HANYA seed jika tabel kosong (jangan timpa barberman yang sudah dihapus/diedit admin)
    const barbermanCount = await prisma.barberman.count().catch(() => 0);
    if (barbermanCount === 0) {
      const barbermen = [
        { id: "brb_ari",   name: "Ari",   nickname: "Bang Ari",   phone: "081200004444", isActive: true, branch: "Telkom" },
        { id: "brb_dani",  name: "Dani",  nickname: "Bang Dani",  phone: "081255556666", isActive: true, branch: "Telkom" },
        { id: "brb_azis",  name: "Azis",  nickname: "Bang Azis",  phone: "081233334444", isActive: true, branch: "Telkom" },
        { id: "brb_ade",   name: "Ade",   nickname: "Bang Ade",   phone: "081200001111", isActive: true, branch: "Suta"   },
        { id: "brb_arif",  name: "Arif",  nickname: "Bang Arif",  phone: "081200002222", isActive: true, branch: "Suta"   },
        { id: "brb_akmal", name: "Akmal", nickname: "Bang Akmal", phone: "081200003333", isActive: true, branch: "Suta"   },
      ];
      for (const b of barbermen) {
        try {
          await prisma.barberman.create({ data: b });
        } catch {}
      }
    }

    // 4. Services
    const services = [
      { id: "srv_haircut_classic", name: "Classic Haircut", category: "HAIRCUT", price: 40000, durationMinutes: 30, isActive: true },
      { id: "srv_haircut_premium", name: "Premium Haircut (Wash + Massage)", category: "HAIRCUT", price: 60000, durationMinutes: 45, isActive: true },
      { id: "srv_kids_haircut", name: "Kids Haircut", category: "HAIRCUT", price: 35000, durationMinutes: 25, isActive: true },
      { id: "srv_beard_trim", name: "Beard Trim & Hot Towel Shave", category: "SHAVE", price: 25000, durationMinutes: 20, isActive: true },
      { id: "srv_hair_spa", name: "Hair Spa & Creambath", category: "TREATMENT", price: 75000, durationMinutes: 40, isActive: true },
      { id: "srv_hair_coloring", name: "Hair Coloring (Basic Black/Brown)", category: "COLORING", price: 120000, durationMinutes: 60, isActive: true },
    ];
    for (const s of services) {
      await prisma.service.upsert({
        where: { id: s.id },
        update: {},
        create: s,
      });
    }

    // 5. Product Categories & Products
    const catPomade = await prisma.productCategory.upsert({
      where: { slug: "pomade" },
      update: {},
      create: { id: "cat_pomade", name: "Pomade", slug: "pomade", description: "Minyak rambut pria styling rapi" },
    });
    const catTonic = await prisma.productCategory.upsert({
      where: { slug: "tonic" },
      update: {},
      create: { id: "cat_tonic", name: "Tonic", slug: "tonic", description: "Tonik penyegar rambut" },
    });
    const catPowder = await prisma.productCategory.upsert({
      where: { slug: "powder" },
      update: {},
      create: { id: "cat_powder", name: "Powder", slug: "powder", description: "Styling powder bervolume" },
    });

    const products = [
      { id: "prd_pomade_01", categoryId: catPomade.id, sku: "POM-SUV-01", name: "Suavecito Matte Pomade 4oz", costPrice: 85000, sellingPrice: 130000, stock: 24, minStock: 5, unit: "pot", isActive: true },
      { id: "prd_pomade_02", categoryId: catPomade.id, sku: "POM-CHF-02", name: "Chief Solid Black Pomade 4.2oz", costPrice: 90000, sellingPrice: 145000, stock: 18, minStock: 5, unit: "pot", isActive: true },
      { id: "prd_tonic_01", categoryId: catTonic.id, sku: "TON-HRB-01", name: "Hair Tonic Herbal Ginseng 200ml", costPrice: 35000, sellingPrice: 60000, stock: 16, minStock: 5, unit: "botol", isActive: true },
      { id: "prd_powder_01", categoryId: catPowder.id, sku: "PWD-DST-01", name: "Dust It Texture Hair Styling Powder 10g", costPrice: 45000, sellingPrice: 80000, stock: 22, minStock: 5, unit: "botol", isActive: true },
    ];
    for (const p of products) {
      await prisma.product.upsert({
        where: { id: p.id },
        update: {},
        create: p,
      });
    }

    // 6. Cash Float
    await prisma.cashTransaction.upsert({
      where: { id: "csh_init" },
      update: {},
      create: {
        id: "csh_init",
        type: "CASH_IN",
        category: "Modal Awal",
        amount: 100000,
        description: "Kas float modal awal laci kasir",
        source: "MANUAL_IN",
      },
    });

    console.log("✅ Auto-seed data awal Supabase berhasil dijalankan!");
  } catch (err: any) {
    console.error("⚠️ Auto-seed error:", err?.message || err);
  }
}

export async function findAdminUser(usernameOrEmail: string) {
  const cleanInput = (usernameOrEmail || "").trim();
  const lowerInput = cleanInput.toLowerCase();

  return safeDb(
    async () => {
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: { equals: cleanInput, mode: "insensitive" } },
            { email: { equals: cleanInput, mode: "insensitive" } },
          ],
        },
      });

      // Jika user belum ada di Supabase, cek apakah database masih kosong atau cari admin apapun
      if (!user) {
        const userCount = await prisma.user.count().catch(() => 0);
        if (userCount === 0) {
          console.log("🌱 Database Supabase baru (0 akun admin), melakukan auto-seed default...");
          await autoSeedSupabaseDatabase();
        }

        // Coba cari lagi setelah auto-seed
        user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: { equals: cleanInput, mode: "insensitive" } },
              { email: { equals: cleanInput, mode: "insensitive" } },
            ],
          },
        });
      }

      // Jika MASIH belum ada, buat langsung akun sesuai request jika itu akun resmi
      if (!user) {
        const passwordHash = "$2a$10$cS0SEMAI7ePLiuHs/VlGv.H0weDyjirNgwDGA16tWZewUErJADc7i"; // admin123
        try {
          if (lowerInput === "owner") {
            user = await prisma.user.create({ data: { id: "usr_owner", username: "owner", email: "owner@adbarbershop.com", passwordHash, name: "Owner AD Barbershop", role: "OWNER", branch: "All" } });
          } else if (lowerInput === "admin_telkom") {
            user = await prisma.user.create({ data: { id: "usr_admin_telkom", username: "admin_telkom", email: "telkom@adbarbershop.com", passwordHash, name: "Admin Telkom", role: "ADMIN_TELKOM", branch: "Telkom" } });
          } else if (lowerInput === "admin_suta") {
            user = await prisma.user.create({ data: { id: "usr_admin_suta", username: "admin_suta", email: "suta@adbarbershop.com", passwordHash, name: "Admin Suta", role: "ADMIN_SUTA", branch: "Suta" } });
          }
        } catch (e) {
          user = await prisma.user.findFirst({ where: { username: { equals: cleanInput, mode: "insensitive" } } });
        }
      }

      return user;
    },
    () => {
      const user = memoryDB.users.find(
        (u) =>
          u.username.toLowerCase() === lowerInput ||
          u.email.toLowerCase() === lowerInput
      );
      if (user) return user;

      if (lowerInput.includes("telkom")) {
        return memoryDB.users.find((u) => u.role === "ADMIN_TELKOM") || memoryDB.users[0];
      }
      if (lowerInput.includes("suta")) {
        return memoryDB.users.find((u) => u.role === "ADMIN_SUTA") || memoryDB.users[0];
      }
      if (lowerInput.includes("owner")) {
        return memoryDB.users.find((u) => u.role === "OWNER") || memoryDB.users[0];
      }
      if (
        lowerInput === "admin" ||
        lowerInput === "admin@adbarbershop.com" ||
        lowerInput.includes("admin")
      ) {
        return memoryDB.users.find((u) => u.username === "admin") || memoryDB.users[0];
      }
      return memoryDB.users[0] || null;
    }
  );
}

export async function updateAdminPassword(newPasswordHash: string) {
  return safeDb(
    async () => {
      const user = await prisma.user.findFirst({ where: { role: "ADMIN" } });
      if (user) {
        return await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: newPasswordHash },
        });
      }
      return null;
    },
    () => {
      if (memoryDB.users && memoryDB.users.length > 0) {
        memoryDB.users[0].passwordHash = newPasswordHash;
      }
      return { success: true };
    },
    true
  );
}

// -------------------------------------------------------------
// BUSINESS SERVICES
// -------------------------------------------------------------

export async function getShopSettings() {
  return safeDb(
    async () => {
      let settings = await prisma.shopSetting.findUnique({ where: { id: "default" } });
      if (!settings) {
        settings = await prisma.shopSetting.create({
          data: { id: "default", shopName: "AD BARBERSHOP" },
        });
      }
      return settings;
    },
    () => memoryDB.shopSettings
  );
}

export async function updateShopSettings(data: any) {
  return safeDb(
    async () => {
      const res = await prisma.shopSetting.upsert({
        where: { id: "default" },
        update: data,
        create: { id: "default", ...data },
      });

      if (data.initialCashFloat !== undefined) {
        const floatVal = Number(data.initialCashFloat);
        const existingInit = await prisma.cashTransaction.findFirst({
          where: { category: "Modal Awal" },
        });
        if (existingInit) {
          await prisma.cashTransaction.update({
            where: { id: existingInit.id },
            data: { amount: floatVal },
          });
        } else if (floatVal > 0) {
          await prisma.cashTransaction.create({
            data: {
              type: "CASH_IN",
              category: "Modal Awal",
              amount: floatVal,
              description: "Kas float awal laci kasir",
              source: "MANUAL_IN",
            },
          });
        }
      }

      return res;
    },
    () => {
      memoryDB.shopSettings = { ...memoryDB.shopSettings, ...data };

      if (data.initialCashFloat !== undefined) {
        const floatVal = Number(data.initialCashFloat);
        const initEntry = memoryDB.cashTransactions.find(
          (c) => c.category === "Modal Awal" || c.id === "csh_init"
        );
        if (initEntry) {
          initEntry.amount = floatVal;
        } else if (floatVal > 0) {
          memoryDB.cashTransactions.unshift({
            id: "csh_init",
            type: "CASH_IN",
            category: "Modal Awal",
            amount: floatVal,
            description: "Kas float awal laci kasir",
            source: "MANUAL_IN",
            createdAt: new Date(),
          });
        }
      }

      return memoryDB.shopSettings;
    },
    true
  );
}

// BARBERMAN (Mendukung Multi-Cabang, Home Branch permanen, & Status DIPERBANTUKAN)
export async function getBarbermen(includeInactive = false, workingBranch?: string) {
  const dbUrl = process.env.DATABASE_URL || "";
  const hasPersistentDb = !!dbUrl && !dbUrl.includes("[YOUR-") && !dbUrl.includes("placeholder");

  let rawList: any[] = [];
  if (hasPersistentDb) {
    const where: any = {};
    if (!includeInactive) where.isActive = true;
    rawList = await prisma.barberman.findMany({
      where,
      orderBy: { name: "asc" },
    }).catch(() => []);
  } else {
    await initMemoryDBIfNeeded();
    syncFromLocalDB();
    rawList = memoryDB.barbermen || [];
    if (!includeInactive) rawList = rawList.filter((b) => b.isActive !== false);
  }

  const sutaNames = ["ade", "arif", "akmal"];
  let list = rawList.map((b: any) => {
    const isSutaDefault = sutaNames.some((n) => (b.name || "").toLowerCase().includes(n));
    const homeBranch = b.homeBranch || (isSutaDefault ? "Suta" : "Telkom");
    const currentWorking = b.workingBranch || b.branch || homeBranch;
    const isActive = b.isActive !== false;
    let status = b.status || (isActive ? (currentWorking !== homeBranch ? "DIPERBANTUKAN" : "AKTIF") : "LIBUR");

    return {
      ...b,
      homeBranch,
      workingBranch: currentWorking,
      branch: currentWorking,
      isActive,
      status,
    };
  });

  if (workingBranch && workingBranch !== "All") {
    list = list.filter((b) => b.workingBranch === workingBranch);
  }

  return list;
}

export async function createBarberman(data: { name: string; nickname?: string; phone?: string; photoUrl?: string; branch?: string; isActive?: boolean }) {
  await initMemoryDBIfNeeded();
  const sutaNames = ["ade", "arif", "akmal"];
  const lower = (data.name || "").toLowerCase();
  const defaultHome = data.branch || (sutaNames.some((n) => lower.includes(n)) ? "Suta" : "Telkom");
  const payload = {
    name: data.name.trim(),
    nickname: data.nickname || data.name,
    phone: data.phone || "",
    photoUrl: data.photoUrl || null,
    homeBranch: defaultHome,
    workingBranch: data.branch || defaultHome,
    branch: data.branch || defaultHome,
    isActive: data.isActive !== false,
    status: data.isActive === false ? "LIBUR" : "AKTIF",
  };
  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl && !dbUrl.includes("[YOUR-") && !dbUrl.includes("placeholder")) {
    if (!(await isDatabaseConnected())) throw new Error("Database Supabase tidak terhubung.");
    const id = `brb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const created = await prisma.barberman.create({ data: { id, ...payload } });
    await hydrateFromSupabase();
    return created;
  }
  const newBarberman = { id: `brb_${Date.now()}`, createdAt: new Date(), ...payload };
  memoryDB.barbermen.push(newBarberman);
  saveLocalDB();
  return newBarberman;
}


export async function updateBarberman(id: string, data: any) {
  await initMemoryDBIfNeeded();
  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl && !dbUrl.includes("[YOUR-") && !dbUrl.includes("placeholder")) {
    if (!(await isDatabaseConnected())) throw new Error("Database Supabase tidak terhubung.");
    const current = await prisma.barberman.findUnique({ where: { id } });
    if (!current) throw new Error("Barberman tidak ditemukan");
    const sutaNames = ["ade", "arif", "akmal"];
    const homeBranch = current.homeBranch || (sutaNames.some((n) => current.name.toLowerCase().includes(n)) ? "Suta" : "Telkom");
    const targetWorking = data.workingBranch || data.branch || current.workingBranch || homeBranch;
    const isActive = data.isActive !== undefined ? data.isActive : current.isActive;
    const updated = await prisma.barberman.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.nickname !== undefined ? { nickname: data.nickname } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.photoUrl !== undefined ? { photoUrl: data.photoUrl } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        branch: targetWorking,
        homeBranch,
        workingBranch: targetWorking,
        status: !isActive ? "LIBUR" : targetWorking !== homeBranch ? "DIPERBANTUKAN" : "AKTIF",
      },
    });
    await hydrateFromSupabase();
    return updated;
  }
  const idx = memoryDB.barbermen.findIndex((b) => b.id === id);
  if (idx === -1) throw new Error("Barberman tidak ditemukan");
  memoryDB.barbermen[idx] = { ...memoryDB.barbermen[idx], ...data };
  saveLocalDB();
  return memoryDB.barbermen[idx];
}


export async function deleteBarberman(id: string) {
  await initMemoryDBIfNeeded();
  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl && !dbUrl.includes("[YOUR-") && !dbUrl.includes("placeholder")) {
    if (!(await isDatabaseConnected())) throw new Error("Database Supabase tidak terhubung.");
    await prisma.barberman.delete({ where: { id } });
    await hydrateFromSupabase();
    return { success: true };
  }
  memoryDB.barbermen = memoryDB.barbermen.filter((b) => b.id !== id);
  saveLocalDB();
  return { success: true };
}


export async function getServices(includeInactive = false) {
  return safeDb(
    async () => {
      return await prisma.service.findMany({
        where: includeInactive ? undefined : { isActive: true },
        orderBy: { category: "asc" },
      });
    },
    () => {
      if (includeInactive) return memoryDB.services;
      return memoryDB.services.filter((s) => s.isActive);
    }
  );
}

export async function createService(data: any) {
  return safeDb(
    async () => {
      return await prisma.service.create({ data });
    },
    () => {
      const newS = { id: `srv_${Date.now()}`, isActive: true, createdAt: new Date(), ...data };
      memoryDB.services.push(newS);
      return newS;
    },
    true
  );
}

export async function updateService(id: string, data: any) {
  return safeDb(
    async () => {
      return await prisma.service.update({ where: { id }, data });
    },
    () => {
      const idx = memoryDB.services.findIndex((s) => s.id === id);
      if (idx !== -1) {
        memoryDB.services[idx] = { ...memoryDB.services[idx], ...data };
        return memoryDB.services[idx];
      }
      return null;
    },
    true
  );
}

export async function deleteService(id: string) {
  return safeDb(
    async () => {
      return await prisma.service.delete({ where: { id } });
    },
    () => {
      memoryDB.services = memoryDB.services.filter((s) => s.id !== id);
      return { success: true };
    },
    true
  );
}

// PRODUCTS & INVENTORY
export async function getProducts(categoryId?: string) {
  return safeDb(
    async () => {
      return await prisma.product.findMany({
        where: categoryId ? { categoryId, isActive: true } : { isActive: true },
        include: { category: true },
        orderBy: { name: "asc" },
      });
    },
    () => {
      let list = memoryDB.products.filter((p) => p.isActive);
      if (categoryId) list = list.filter((p) => p.categoryId === categoryId);
      return list.map((p) => ({
        ...p,
        category: memoryDB.categories.find((c) => c.id === p.categoryId) || null,
      }));
    }
  );
}

export async function getProductCategories() {
  return safeDb(
    async () => {
      return await prisma.productCategory.findMany({ orderBy: { name: "asc" } });
    },
    () => memoryDB.categories
  );
}

export async function createProduct(data: any) {
  return safeDb(
    async () => {
      return await prisma.product.create({ data });
    },
    () => {
      const newP = { id: `prd_${Date.now()}`, isActive: true, createdAt: new Date(), ...data };
      memoryDB.products.push(newP);
      return newP;
    },
    true
  );
}

export async function updateProduct(id: string, data: any) {
  return safeDb(
    async () => {
      return await prisma.product.update({ where: { id }, data });
    },
    () => {
      const idx = memoryDB.products.findIndex((p) => p.id === id);
      if (idx !== -1) {
        memoryDB.products[idx] = { ...memoryDB.products[idx], ...data };
        return memoryDB.products[idx];
      }
      return null;
    },
    true
  );
}

export async function adjustStock(productId: string, type: "IN" | "OUT" | "ADJUSTMENT", quantity: number, reason: string, notes?: string) {
  return safeDb(
    async () => {
      const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
      const prevStock = product.stock;
      let newStock = prevStock;
      if (type === "IN") newStock += quantity;
      else if (type === "OUT") newStock = Math.max(0, prevStock - quantity);
      else if (type === "ADJUSTMENT") newStock = quantity;

      const [updatedProduct, movement] = await prisma.$transaction([
        prisma.product.update({
          where: { id: productId },
          data: { stock: newStock },
        }),
        prisma.stockMovement.create({
          data: {
            productId,
            type,
            quantity,
            previousStock: prevStock,
            currentStock: newStock,
            reason,
            notes,
          },
        }),
      ]);

      return { product: updatedProduct, movement };
    },
    () => {
      const p = memoryDB.products.find((prod) => prod.id === productId);
      if (!p) throw new Error("Produk tidak ditemukan");
      const prevStock = p.stock;
      let newStock = prevStock;
      if (type === "IN") newStock += quantity;
      else if (type === "OUT") newStock = Math.max(0, prevStock - quantity);
      else if (type === "ADJUSTMENT") newStock = quantity;

      p.stock = newStock;
      const movement = {
        id: `stk_${Date.now()}`,
        productId,
        type,
        quantity,
        previousStock: prevStock,
        currentStock: newStock,
        reason,
        notes,
        createdAt: new Date(),
      };
      memoryDB.stockMovements.push(movement);
      return { product: p, movement };
    },
    true
  );
}

// PRODUCT TRANSFERS (Transfer Antar Cabang Telkom & Suta)
export interface CreateTransferInput {
  productId: string;
  fromBranch: string;
  toBranch: string;
  quantity: number;
  notes?: string;
  createdBy?: string;
}

export async function getProductTransfers(branch?: string) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();
  let list = (memoryDB.transfers || []).sort(
    (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  if (branch && branch !== "All") {
    list = list.filter(
      (t: any) =>
        (t.fromBranch && t.fromBranch.toLowerCase().includes(branch.toLowerCase())) ||
        (t.toBranch && t.toBranch.toLowerCase().includes(branch.toLowerCase()))
    );
  }
  return list;
}

export async function createProductTransfer(input: CreateTransferInput) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();

  const product = memoryDB.products.find((p) => p.id === input.productId);
  if (!product) throw new Error("Produk tidak ditemukan");

  const qty = Number(input.quantity);
  if (isNaN(qty) || qty <= 0) throw new Error("Jumlah transfer harus lebih dari 0");

  const tlkFrom = input.fromBranch.toLowerCase().includes("telkom");
  const isFromSuta = input.fromBranch.toLowerCase().includes("suta");

  // Pastikan stok cabang pengirim terhitung dengan akurat
  if (product.stockTelkom === undefined || product.stockSuta === undefined) {
    const tot = product.stock || 0;
    product.stockTelkom = Math.ceil(tot / 2);
    product.stockSuta = Math.floor(tot / 2);
    product.stock = product.stockTelkom + product.stockSuta;
  }

  const senderStock = tlkFrom ? product.stockTelkom : product.stockSuta;

  // Z. VALIDASI TRANSFER: Tolak jika stok tidak mencukupi
  if (senderStock < qty) {
    throw new Error(`Stok tidak mencukupi. Stok tersedia: ${senderStock}.`);
  }

  // AA. ATOMIC TRANSFER: Pengirim berkurang, penerima bertambah serentak
  if (tlkFrom) {
    product.stockTelkom = Math.max(0, product.stockTelkom - qty);
    product.stockSuta = (product.stockSuta || 0) + qty;
  } else {
    product.stockSuta = Math.max(0, product.stockSuta - qty);
    product.stockTelkom = (product.stockTelkom || 0) + qty;
  }
  product.stock = (product.stockTelkom || 0) + (product.stockSuta || 0);

  const todayStr = format(new Date(), "yyyyMMdd");
  const codeFrom = tlkFrom ? "TLK" : "SUT";
  const codeTo = tlkFrom ? "SUT" : "TLK";
  const count = (memoryDB.transfers?.length || 0) + 1;
  const transferNumber = `TRF-${codeFrom}-${codeTo}-${todayStr}-${String(count).padStart(3, "0")}`;

  const category = memoryDB.categories.find((c) => c.id === product.categoryId);

  const transferRecord = {
    id: `trf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    transferNumber,
    productId: product.id,
    productName: product.name,
    productSku: product.sku,
    categoryName: category?.name || "Produk",
    fromBranch: input.fromBranch,
    toBranch: input.toBranch,
    quantity: qty,
    unit: product.unit || "pcs",
    notes: input.notes || "Transfer stok operasional cabang",
    createdBy: input.createdBy || "Admin",
    status: "COMPLETED",
    createdAt: new Date().toISOString(),
    stockTelkomAfter: product.stockTelkom,
    stockSutaAfter: product.stockSuta,
  };

  if (!memoryDB.transfers) {
    memoryDB.transfers = [];
  }
  memoryDB.transfers.unshift(transferRecord);

  // Catat ke movement log
  memoryDB.stockMovements.push({
    id: `stk_trf_out_${Date.now()}`,
    productId: product.id,
    type: "OUT" as const,
    quantity: qty,
    previousStock: senderStock,
    currentStock: tlkFrom ? product.stockTelkom : product.stockSuta,
    reason: `Transfer Keluar: ${input.fromBranch} → ${input.toBranch} (${transferNumber})`,
    notes: input.notes || "",
    createdAt: new Date(),
  });

  // Catat Activity Log
  await recordActivity({
    action: "TRANSFER_PRODUK",
    description: `Transfer ${qty} ${product.unit || "pcs"} ${product.name} dari ${input.fromBranch} ke ${input.toBranch} (${transferNumber})`,
    branch: tlkFrom ? "Telkom" : "Suta",
    actor: input.createdBy || "Admin",
  });

  // DUAL-WRITE ke Supabase
  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("[YOUR-")) {
      await prisma.$executeRawUnsafe(
        `UPDATE "products" SET "stock_telkom" = $1, "stock_suta" = $2, "stock" = $3 WHERE "id" = $4`,
        product.stockTelkom,
        product.stockSuta,
        product.stock,
        product.id
      ).catch(() => {});
    }
  } catch {}

  saveLocalDB();
  return transferRecord;
}

// CUSTOMERS (Mendukung 4 macam kasus: Nama saja, Nama+HP, Nama+IG, Nama+HP+IG)
export async function getCustomers(query?: string) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();

  let list = memoryDB.customers || [];
  if (!query || query.trim() === "") {
    return list.map((c) => ({
      ...c,
      favoriteBarberman: memoryDB.barbermen.find((b) => b.id === c.favoriteBarbermanId) || null,
    }));
  }
  const q = query.toLowerCase().trim();
  return list
    .filter((c) => {
      const matchName = c.name?.toLowerCase().includes(q);
      const matchPhone = c.phone?.toLowerCase().includes(q);
      const matchIg = c.instagram?.toLowerCase().includes(q);
      return matchName || matchPhone || matchIg;
    })
    .map((c) => ({
      ...c,
      favoriteBarberman: memoryDB.barbermen.find((b) => b.id === c.favoriteBarbermanId) || null,
    }));
}

export async function createCustomer(data: { name: string; phone?: string | null; instagram?: string | null; address?: string | null; notes?: string | null; branch?: string | null }) {
  await initMemoryDBIfNeeded();
  const clean = {
    name: data.name.trim(),
    phone: data.phone?.trim() || null,
    instagram: data.instagram?.trim() || null,
    address: data.address?.trim() || null,
    notes: data.notes?.trim() || null,
    branch: data.branch?.trim() || "Telkom",
    totalVisits: 0,
    totalSpend: 0,
  };
  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl && !dbUrl.includes("[YOUR-") && !dbUrl.includes("placeholder")) {
    if (!(await isDatabaseConnected())) throw new Error("Database Supabase tidak terhubung.");
    const created = await prisma.customer.create({ data: { id: `cst_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, ...clean } });
    await hydrateFromSupabase();
    return created;
  }
  const customerData = { id: `cst_${Date.now()}`, ...clean, lastVisitAt: null, favoriteBarbermanId: null, createdAt: new Date() };
  memoryDB.customers.unshift(customerData);
  saveLocalDB();
  return customerData;
}


export async function updateCustomer(id: string, data: { name?: string; phone?: string | null; instagram?: string | null; address?: string | null; notes?: string | null; branch?: string | null }) {
  await initMemoryDBIfNeeded();
  const dbUrl = process.env.DATABASE_URL || "";
  const prismaData: any = {};
  if (data.name !== undefined) prismaData.name = data.name.trim();
  if (data.phone !== undefined) prismaData.phone = data.phone?.trim() || null;
  if (data.instagram !== undefined) prismaData.instagram = data.instagram?.trim() || null;
  if (data.address !== undefined) prismaData.address = data.address?.trim() || null;
  if (data.notes !== undefined) prismaData.notes = data.notes?.trim() || null;
  if (data.branch !== undefined) prismaData.branch = data.branch?.trim() || "Telkom";
  if (dbUrl && !dbUrl.includes("[YOUR-") && !dbUrl.includes("placeholder")) {
    if (!(await isDatabaseConnected())) throw new Error("Database Supabase tidak terhubung.");
    const updated = await prisma.customer.update({ where: { id }, data: prismaData });
    await hydrateFromSupabase();
    return updated;
  }
  const idx = memoryDB.customers.findIndex((c: any) => c.id === id);
  if (idx === -1) throw new Error("Customer tidak ditemukan");
  memoryDB.customers[idx] = { ...memoryDB.customers[idx], ...prismaData };
  saveLocalDB();
  return memoryDB.customers[idx];
}


export async function deleteCustomer(id: string) {
  await initMemoryDBIfNeeded();
  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl && !dbUrl.includes("[YOUR-") && !dbUrl.includes("placeholder")) {
    if (!(await isDatabaseConnected())) throw new Error("Database Supabase tidak terhubung.");
    await prisma.customer.delete({ where: { id } });
    await hydrateFromSupabase();
    return { success: true };
  }
  memoryDB.customers = memoryDB.customers.filter((c: any) => c.id !== id);
  saveLocalDB();
  return { success: true };
}


export async function getCustomerDetail(id: string) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();

  const customer = (memoryDB.customers || []).find((c) => c.id === id);
  if (!customer) return null;
  const txs = (memoryDB.transactions || [])
    .filter((t) => t.customerId === id || (t.customerName && t.customerName.toLowerCase() === customer.name.toLowerCase()))
    .map((t) => ({
      ...t,
      barberman: (memoryDB.barbermen || []).find((b) => b.id === t.barbermanId) || null,
      items: (memoryDB.transactionItems || []).filter((i) => i.transactionId === t.id),
      payments: (memoryDB.payments || []).filter((p) => p.transactionId === t.id),
    }));
  const mbrs = (memoryDB.members || []).filter((m) => m.customerId === id);
  return {
    ...customer,
    favoriteBarberman: (memoryDB.barbermen || []).find((b) => b.id === customer.favoriteBarbermanId) || null,
    members: mbrs,
    transactions: txs,
  };
}

// MEMBERS
export async function getMembers(query?: string) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();

  let list = memoryDB.members || [];
  if (query && query.trim() !== "") {
    const q = query.toLowerCase().trim();
    list = list.filter(
      (m) =>
        m.memberCode?.toLowerCase().includes(q) ||
        m.name?.toLowerCase().includes(q) ||
        m.phone?.toLowerCase().includes(q)
    );
  }
  return list.map((m) => ({
    ...m,
    customer: memoryDB.customers.find((c) => c.id === m.customerId) || null,
  }));
}

export async function createMember(data: any) {
  return safeDb(
    async () => {
      return await prisma.member.create({ data });
    },
    () => {
      const newM = {
        id: `mbr_${Date.now()}`,
        totalVisits: 0,
        totalSpend: 0,
        status: "ACTIVE",
        createdAt: new Date(),
        ...data,
      };
      memoryDB.members.push(newM);
      return newM;
    },
    true
  );
}

export async function extendMember(id: string, additionalDays: number) {
  return safeDb(
    async () => {
      const existing = await prisma.member.findUniqueOrThrow({ where: { id } });
      const currentEnd = new Date(existing.endDate) > new Date() ? new Date(existing.endDate) : new Date();
      const newEnd = new Date(currentEnd.getTime() + additionalDays * 24 * 60 * 60 * 1000);
      return await prisma.member.update({
        where: { id },
        data: { endDate: newEnd, status: "ACTIVE" },
      });
    },
    () => {
      const m = memoryDB.members.find((item) => item.id === id);
      if (!m) throw new Error("Member tidak ditemukan");
      const currentEnd = new Date(m.endDate) > new Date() ? new Date(m.endDate) : new Date();
      m.endDate = new Date(currentEnd.getTime() + additionalDays * 24 * 60 * 60 * 1000);
      m.status = "ACTIVE";
      return m;
    },
    true
  );
}

export async function deleteMember(id: string) {
  return safeDb(
    async () => {
      await prisma.member.delete({ where: { id } });
      return { success: true };
    },
    () => {
      const idx = memoryDB.members.findIndex((m) => m.id === id);
      if (idx === -1) throw new Error("Member tidak ditemukan");
      memoryDB.members.splice(idx, 1);
      return { success: true };
    },
    true
  );
}

// BOOKINGS
export async function getBookings(dateStr?: string, branch?: string) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();

  let list = (memoryDB.bookings || []).map((b) => {
    const barber = memoryDB.barbermen.find((bar) => bar.id === b.barbermanId) || null;
    const bBranch = b.branch || barber?.workingBranch || barber?.branch || "Telkom";
    return {
      ...b,
      branch: bBranch,
      barberman: barber,
      service: memoryDB.services.find((s) => s.id === b.serviceId) || null,
      customer: memoryDB.customers.find((c) => c.id === b.customerId) || null,
    };
  });

  if (dateStr) {
    const targetDay = new Date(dateStr).toISOString().split("T")[0];
    list = list.filter((b) => {
      const bDay = new Date(b.bookingDate).toISOString().split("T")[0];
      return bDay === targetDay;
    });
  }

  if (branch && branch !== "All") {
    list = list.filter((b) => b.branch === branch);
  }

  return list.sort((a, b) => (a.bookingTime || "").localeCompare(b.bookingTime || ""));
}

export async function createBooking(data: any) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();

  // AP. CEGAH DOUBLE BOOKING: Barber yang sama, tanggal yang sama, jam yang sama
  const targetDateStr = new Date(data.bookingDate).toISOString().split("T")[0];
  const duplicate = memoryDB.bookings.find((b: any) => {
    if (b.barbermanId !== data.barbermanId) return false;
    if (b.status === "CANCELLED" || b.status === "RESCHEDULE") return false;
    const bDateStr = new Date(b.bookingDate).toISOString().split("T")[0];
    return bDateStr === targetDateStr && b.bookingTime === data.bookingTime;
  });

  if (duplicate) {
    throw new Error("Slot barber tersebut sudah terisi. Silakan pilih waktu atau barber lain.");
  }

  const barber = memoryDB.barbermen.find((b) => b.id === data.barbermanId);
  const targetBranch = data.branch || barber?.workingBranch || barber?.branch || "Telkom";

  const newB = {
    id: `bkg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    customerName: data.customerName.trim(),
    customerPhone: data.customerPhone?.trim() || null,
    barbermanId: data.barbermanId,
    serviceId: data.serviceId,
    bookingDate: new Date(data.bookingDate),
    bookingTime: data.bookingTime,
    notes: data.notes || null,
    branch: targetBranch,
    dpPaid: 20000,
    dpAmount: 20000,
    dpStatus: data.dpStatus || "SUDAH_DIBAYAR",
    status: data.status || "CONFIRMED",
    createdAt: new Date(),
  };

  memoryDB.bookings.unshift(newB);

  await recordActivity({
    action: "BOOKING_BARU",
    description: `Booking baru untuk ${newB.customerName} (${newB.bookingTime}) di Cabang ${targetBranch} dengan DP Rp20.000`,
    branch: targetBranch,
    actor: newB.customerName,
  });

  // DUAL-WRITE ke Supabase
  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("[YOUR-")) {
      await prisma.booking.create({
        data: {
          id: newB.id,
          customerName: newB.customerName,
          customerPhone: newB.customerPhone || undefined,
          barbermanId: newB.barbermanId,
          serviceId: newB.serviceId,
          bookingDate: new Date(newB.bookingDate),
          bookingTime: newB.bookingTime,
          notes: newB.notes || undefined,
          status: (newB.status === "TERLAMBAT" || newB.status === "RESCHEDULE" ? "CONFIRMED" : newB.status) as any,
        },
      }).catch((e: any) => console.warn("⚠️ [createBooking] Prisma create:", e?.message));
    }
  } catch {}

  saveLocalDB();
  return newB;
}

export async function updateBookingStatus(id: string, status: any, options?: any) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();

  const b = memoryDB.bookings.find((item) => item.id === id);
  if (!b) throw new Error("Booking tidak ditemukan");

  const prevStatus = b.status;
  b.status = status;

  // AJ, AK, AL. RESCHEDULE & NO_SHOW: DP Rp 20.000 HANGUS
  if (status === "RESCHEDULE" || status === "NO_SHOW") {
    b.dpStatus = "HANGUS";
    b.status = status;
    await recordActivity({
      action: status === "RESCHEDULE" ? "BOOKING_RESCHEDULE" : "BOOKING_NO_SHOW",
      description: `Booking ${b.customerName} status ${status}: DP Rp20.000 dinyatakan HANGUS sesuai aturan.`,
      branch: b.branch || "Telkom",
      actor: "Admin",
    });
  } else if (status === "TERLAMBAT") {
    // AH & AI. TERLAMBAT DI HARI-H (toleransi 15 menit): DP TIDAK HANGUS, tetap dapat dilayani jika ada slot kosong
    b.status = "TERLAMBAT";
    b.dpStatus = "SUDAH_DIBAYAR"; // DP TETAP AMAN / BERLAKU
    await recordActivity({
      action: "BOOKING_TERLAMBAT",
      description: `Customer ${b.customerName} terlambat datang (>15 menit). Status Terlambat, DP Rp20.000 TIDAK HANGUS (tetap berlaku jika ada slot kosong).`,
      branch: b.branch || "Telkom",
      actor: "Admin",
    });
  } else if (status === "SUDAH_DIBAYAR" || status === "VERIFIKASI_DP") {
    b.dpStatus = "SUDAH_DIBAYAR";
    b.status = "CONFIRMED";
    await recordActivity({
      action: "VERIFIKASI_DP",
      description: `Verifikasi pembayaran DP Rp20.000 untuk ${b.customerName} berhasil (LUNAS).`,
      branch: b.branch || "Telkom",
      actor: "Admin",
    });
  } else {
    await recordActivity({
      action: "UPDATE_STATUS_BOOKING",
      description: `Status booking ${b.customerName} diubah dari ${prevStatus} menjadi ${status}`,
      branch: b.branch || "Telkom",
      actor: "Admin",
    });
  }

  // DUAL-WRITE ke Supabase
  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("[YOUR-")) {
      const prismaStatus = (b.status === "TERLAMBAT" || b.status === "RESCHEDULE" || b.status === "HANGUS" || b.status === "VERIFIKASI_DP" || b.status === "SUDAH_DIBAYAR")
        ? "CONFIRMED" : b.status;
      await prisma.booking.update({
        where: { id },
        data: { status: prismaStatus as any },
      }).catch((e: any) => console.warn("⚠️ [updateBookingStatus] Prisma update:", e?.message));
    }
  } catch {}

  saveLocalDB();
  return b;
}

// -------------------------------------------------------------
// CHECKOUT TRANSAKSI KASIR (POS)
// Otomatis:
// 1. Catat transaksi & items & payment
// 2. Potong stok produk & catat stock_movement
// 3. Tambah customer: total_visits + 1, total_spend + total, update last_visit_at
// 4. Update barberman favorit / tracking performa
// 5. Jika metode bayar CASH -> otomatis catat ke cash_transactions (Cash In)
// -------------------------------------------------------------

export interface CheckoutPayload {
  customerId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerInstagram?: string | null;
  barbermanId: string;
  items: Array<{
    itemType: "SERVICE" | "PRODUCT";
    serviceId?: string | null;
    productId?: string | null;
    name: string;
    price: number;
    costPrice?: number;
    quantity: number;
    subtotal: number;
  }>;
  subtotal: number;
  discount: number;
  grandTotal: number;
  paymentMethod: "CASH" | "QRIS" | "TRANSFER" | "DEBIT" | "KREDIT" | "E_WALLET";
  amountPaid: number;
  changeAmount: number;
  paymentRef?: string;
  notes?: string;
}

export async function processCheckout(payload: CheckoutPayload & { branch?: string }) {
  await initMemoryDBIfNeeded();
  const dbUrl = process.env.DATABASE_URL || "";
  const hasPersistentDb = !!dbUrl && !dbUrl.includes("[YOUR-") && !dbUrl.includes("placeholder");
  if (!hasPersistentDb) return processCheckoutMemoryFallback(payload);
  if (!(await isDatabaseConnected())) {
    throw new Error("Database Supabase tidak terhubung. Transaksi tidak diproses agar tidak ada transaksi yang hilang.");
  }
  await ensureSupabaseSchema();

  const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const invoiceNumber = `AD-${format(new Date(), "yyyyMMdd")}-${Math.floor(1000 + Math.random() * 9000)}`;
  const txBranch = payload.branch || "Telkom";

  const barber = await prisma.barberman.findUnique({ where: { id: payload.barbermanId } });
  if (!barber) throw new Error("Barberman tidak ditemukan di database.");

  // Resolve customer from the persistent database, not the in-memory snapshot.
  let cust: any = null;
  if (payload.customerId) {
    cust = await prisma.customer.findUnique({ where: { id: payload.customerId } });
  }
  if (!cust && payload.customerName) {
    const name = payload.customerName.trim();
    const phone = payload.customerPhone?.trim() || null;
    const instagram = payload.customerInstagram?.trim() || null;
    const or: any[] = [{ name: { equals: name, mode: "insensitive" } }];
    if (phone) or.push({ phone });
    if (instagram) or.push({ instagram: { equals: instagram, mode: "insensitive" } });
    cust = await prisma.customer.findFirst({ where: { OR: or } });
  }

  const customerId = cust?.id || `cst_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date();
  const totalVisits = (cust?.totalVisits || 0) + 1;
  const totalSpend = (cust?.totalSpend || 0) + payload.grandTotal;

  const itemsData = payload.items.map((it, idx) => ({
    id: `txi_${txId}_${idx}`,
    itemType: it.itemType as any,
    serviceId: it.serviceId || undefined,
    productId: it.productId || undefined,
    name: it.name,
    price: Number(it.price),
    costPrice: Number(it.costPrice || 0),
    quantity: Number(it.quantity),
    subtotal: Number(it.subtotal),
  }));
  const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const cashId = `csh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // Everything that makes a checkout a single business operation happens in one
  // PostgreSQL transaction: customer, sale, items, payment, cash and stock.
  const result = await prisma.$transaction(async (tx) => {
    const customer = cust
      ? await tx.customer.update({
          where: { id: cust.id },
          data: {
            name: payload.customerName.trim(),
            ...(payload.customerPhone?.trim() ? { phone: payload.customerPhone.trim() } : {}),
            ...(payload.customerInstagram?.trim() ? { instagram: payload.customerInstagram.trim() } : {}),
            totalVisits,
            totalSpend,
            lastVisitAt: now,
            favoriteBarbermanId: payload.barbermanId,
            branch: txBranch,
          },
        })
      : await tx.customer.create({
          data: {
            id: customerId,
            name: payload.customerName.trim(),
            phone: payload.customerPhone?.trim() || null,
            instagram: payload.customerInstagram?.trim() || null,
            totalVisits,
            totalSpend,
            lastVisitAt: now,
            favoriteBarbermanId: payload.barbermanId,
            branch: txBranch,
          },
        });

    // Lock and deduct every product in the same DB transaction.
    for (const item of itemsData) {
      if (item.itemType !== "PRODUCT" || !item.productId) continue;
      const rows: any[] = await tx.$queryRawUnsafe(
        `SELECT id, stock, stock_telkom, stock_suta FROM "products" WHERE id = $1 FOR UPDATE`,
        item.productId
      );
      const product = rows[0];
      if (!product) throw new Error(`Produk ${item.name} tidak ditemukan di database.`);
      let stockTelkom = Number(product.stock_telkom ?? 0);
      let stockSuta = Number(product.stock_suta ?? 0);
      const totalStock = Number(product.stock ?? 0);
      // Backfill branch stock once if older data only had the total stock.
      if (stockTelkom === 0 && stockSuta === 0 && totalStock > 0) {
        stockTelkom = Math.ceil(totalStock / 2);
        stockSuta = Math.floor(totalStock / 2);
      }
      const currentBranchStock = txBranch === "Suta" ? stockSuta : stockTelkom;
      if (currentBranchStock < item.quantity) {
        throw new Error(`Stok ${item.name} di Cabang ${txBranch} tidak cukup. Tersedia ${currentBranchStock}, diminta ${item.quantity}.`);
      }
      if (txBranch === "Suta") stockSuta -= item.quantity;
      else stockTelkom -= item.quantity;
      const newTotal = stockTelkom + stockSuta;
      await tx.$executeRawUnsafe(
        `UPDATE "products" SET "stock" = $1, "stock_telkom" = $2, "stock_suta" = $3, "updated_at" = NOW() WHERE "id" = $4`,
        newTotal, stockTelkom, stockSuta, item.productId
      );
      await tx.stockMovement.create({
        data: {
          id: `stk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          productId: item.productId,
          type: "OUT",
          quantity: item.quantity,
          previousStock: currentBranchStock,
          currentStock: txBranch === "Suta" ? stockSuta : stockTelkom,
          reason: `Penjualan Kasir Cabang ${txBranch} (${invoiceNumber})`,
          notes: `Customer: ${payload.customerName}`,
        },
      });
    }

    const transaction = await tx.transaction.create({
      data: {
        id: txId,
        invoiceNumber,
        customerId: customer.id,
        customerName: payload.customerName.trim(),
        customerPhone: payload.customerPhone?.trim() || null,
        customerInstagram: payload.customerInstagram?.trim() || null,
        barbermanId: payload.barbermanId,
        subtotal: payload.subtotal,
        discount: payload.discount,
        grandTotal: payload.grandTotal,
        paymentMethod: payload.paymentMethod as any,
        paymentStatus: "PAID",
        notes: payload.notes || null,
        branch: txBranch,
        items: { create: itemsData },
        payments: {
          create: [{
            id: paymentId,
            paymentMethod: payload.paymentMethod as any,
            amountPaid: payload.amountPaid,
            changeAmount: payload.changeAmount,
            paymentRef: payload.paymentRef || null,
          }],
        },
      },
      include: { items: true, payments: true, barberman: true, customer: true },
    });

    if (payload.paymentMethod === "CASH") {
      await tx.cashTransaction.create({
        data: {
          id: cashId,
          type: "CASH_IN",
          category: "Penjualan Kasir",
          amount: payload.grandTotal,
          description: `Pembayaran Cash Kasir ${invoiceNumber} (${payload.customerName})`,
          source: "POS_SALE",
          transactionId: txId,
          branch: txBranch,
        },
      });
    }
    return transaction;
  });

  await hydrateFromSupabase();
  await recordActivity({
    action: "TRANSAKSI_KASIR",
    description: `Transaksi kasir ${invoiceNumber} sebesar Rp ${payload.grandTotal.toLocaleString("id-ID")} di Cabang ${txBranch} (${payload.customerName}) oleh ${barber.name}`,
    branch: txBranch,
    actor: payload.customerName,
  });
  saveLocalDB();

  return result;
}

async function processCheckoutMemoryFallback(payload: CheckoutPayload & { branch?: string }) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();

  const invoiceNumber = `AD-${format(new Date(), "yyyyMMdd")}-${Math.floor(1000 + Math.random() * 9000)}`;
  const barber = memoryDB.barbermen.find((b: any) => b.id === payload.barbermanId);
  const sutaNames = ["ade", "arif", "akmal"];
  const isSutaDefault = sutaNames.some((n) => (barber?.name || "").toLowerCase().includes(n));
  const barberHome = barber?.homeBranch || (isSutaDefault ? "Suta" : "Telkom");
  const txBranch = payload.branch || barber?.workingBranch || barber?.branch || "Telkom";

  // Customer resolution (cari by ID, lalu by Nama/Phone/Instagram sebelum buat baru)
  if (!memoryDB.customers) memoryDB.customers = [];
  let cust = payload.customerId ? memoryDB.customers.find((c) => c.id === payload.customerId) : null;
  if (!cust && payload.customerName) {
    const normName = payload.customerName.trim().toLowerCase();
    const normPhone = payload.customerPhone?.trim();
    const normIg = payload.customerInstagram?.trim().toLowerCase();
    cust = memoryDB.customers.find((c) => 
      (c.name && c.name.trim().toLowerCase() === normName) ||
      (normPhone && c.phone && c.phone.trim() === normPhone) ||
      (normIg && c.instagram && c.instagram.trim().toLowerCase() === normIg)
    );
  }

  if (!cust) {
    cust = {
      id: `cst_${Date.now()}`,
      name: payload.customerName.trim(),
      phone: payload.customerPhone?.trim() || null,
      instagram: payload.customerInstagram?.trim() || null,
      address: null,
      notes: null,
      totalVisits: 1,
      totalSpend: payload.grandTotal,
      lastVisitAt: new Date(),
      favoriteBarbermanId: payload.barbermanId,
      branch: txBranch,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryDB.customers.unshift(cust);
  } else {
    cust.totalVisits = (cust.totalVisits || 0) + 1;
    cust.totalSpend = (cust.totalSpend || 0) + payload.grandTotal;
    cust.lastVisitAt = new Date();
    cust.favoriteBarbermanId = payload.barbermanId;
    cust.branch = txBranch;
    if (payload.customerPhone && !cust.phone) cust.phone = payload.customerPhone.trim();
    if (payload.customerInstagram && !cust.instagram) cust.instagram = payload.customerInstagram.trim();
    cust.updatedAt = new Date();
  }

  const txId = `tx_${Date.now()}`;
  const newTx = {
    id: txId,
    invoiceNumber,
    customerId: cust.id,
    customerName: payload.customerName.trim(),
    customerPhone: payload.customerPhone?.trim() || null,
    customerInstagram: payload.customerInstagram?.trim() || null,
    barbermanId: payload.barbermanId,
    barbermanName: barber?.name || "Barber",
    barbermanHomeBranch: barberHome,
    barbermanWorkingBranch: txBranch,
    branch: txBranch,
    subtotal: payload.subtotal,
    discount: payload.discount,
    grandTotal: payload.grandTotal,
    paymentMethod: payload.paymentMethod,
    paymentStatus: "PAID",
    notes: payload.notes || null,
    createdAt: new Date(),
  };
  memoryDB.transactions.unshift(newTx);

  // Items & Stock deduction per branch (AX. PENJUALAN PRODUK OTOMATIS MENGURANGI STOK CABANG)
  const itemsCreated = payload.items.map((it, idx) => {
    const itemObj = {
      id: `txi_${txId}_${idx}`,
      transactionId: txId,
      itemType: it.itemType,
      serviceId: it.serviceId || null,
      productId: it.productId || null,
      name: it.name,
      price: it.price,
      costPrice: it.costPrice || 0,
      quantity: it.quantity,
      subtotal: it.subtotal,
    };
    memoryDB.transactionItems.push(itemObj);

    if (it.itemType === "PRODUCT" && it.productId) {
      const prod = memoryDB.products.find((p) => p.id === it.productId);
      if (prod) {
        if (prod.stockTelkom === undefined || prod.stockSuta === undefined) {
          const tot = prod.stock || 0;
          prod.stockTelkom = Math.ceil(tot / 2);
          prod.stockSuta = Math.floor(tot / 2);
          prod.stock = prod.stockTelkom + prod.stockSuta;
        }

        const isSuta = txBranch === "Suta";
        const prevStock = isSuta ? prod.stockSuta : prod.stockTelkom;
        if (isSuta) {
          prod.stockSuta = Math.max(0, prod.stockSuta - it.quantity);
        } else {
          prod.stockTelkom = Math.max(0, prod.stockTelkom - it.quantity);
        }
        prod.stock = (prod.stockTelkom || 0) + (prod.stockSuta || 0);

        memoryDB.stockMovements.push({
          id: `stk_${Date.now()}_${idx}`,
          productId: prod.id,
          type: "OUT",
          quantity: it.quantity,
          previousStock: prevStock,
          currentStock: isSuta ? prod.stockSuta : prod.stockTelkom,
          reason: `Penjualan Kasir Cabang ${txBranch} (${invoiceNumber})`,
          notes: `Customer: ${payload.customerName}`,
          createdAt: new Date(),
        });
      }
    }
    return itemObj;
  });

  // Payments
  const paymentObj = {
    id: `pay_${Date.now()}`,
    transactionId: txId,
    paymentMethod: payload.paymentMethod,
    amountPaid: payload.amountPaid,
    changeAmount: payload.changeAmount,
    paymentRef: payload.paymentRef || null,
    createdAt: new Date(),
  };
  memoryDB.payments.push(paymentObj);

  // Cash In jika bayar tunai
  if (payload.paymentMethod === "CASH") {
    memoryDB.cashTransactions.unshift({
      id: `csh_${Date.now()}`,
      type: "CASH_IN",
      category: "Penjualan Kasir",
      amount: payload.grandTotal,
      description: `Pembayaran Cash Kasir ${invoiceNumber} (${payload.customerName})`,
      source: "POS_SALE",
      transactionId: txId,
      branch: txBranch,
      createdAt: new Date(),
    });
  }

  // Catat ke Activity Log (BC)
  await recordActivity({
    action: "TRANSAKSI_KASIR",
    description: `Transaksi kasir ${invoiceNumber} sebesar Rp ${payload.grandTotal.toLocaleString("id-ID")} di Cabang ${txBranch} (${payload.customerName}) oleh ${barber?.name || "Barber"}`,
    branch: txBranch,
    actor: payload.customerName,
  });


  // ─── DUAL-WRITE KE SUPABASE ──────────────────────────────────────────────────
  // Simpan ke Supabase agar data bertahan saat container Vercel di-recycle.
  // Jika Supabase tidak tersambung, data tetap aman di memoryDB + disk lokal.
  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("[YOUR-")) {
      // 0. Pastikan barberman ada di Supabase agar foreign key tidak error
      if (barber) {
        await prisma.barberman.upsert({
          where: { id: barber.id },
          update: {
            name: barber.name,
            branch: barber.workingBranch || barber.branch || "Telkom",
            isActive: barber.isActive !== false,
          },
          create: {
            id: barber.id,
            name: barber.name,
            nickname: barber.nickname || barber.name,
            phone: barber.phone || "",
            branch: barber.workingBranch || barber.branch || "Telkom",
            isActive: barber.isActive !== false,
          },
        }).catch(() => {});
      }

      // 1. Upsert customer
      await prisma.customer.upsert({
        where: { id: cust.id },
        update: {
          name: cust.name,
          totalVisits: cust.totalVisits,
          totalSpend: cust.totalSpend,
          lastVisitAt: cust.lastVisitAt ? new Date(cust.lastVisitAt) : undefined,
          favoriteBarbermanId: cust.favoriteBarbermanId || undefined,
          branch: txBranch,
          ...(cust.phone ? { phone: cust.phone } : {}),
          ...(cust.instagram ? { instagram: cust.instagram } : {}),
        },
        create: {
          id: cust.id,
          name: cust.name,
          phone: cust.phone || undefined,
          instagram: cust.instagram || undefined,
          totalVisits: cust.totalVisits,
          totalSpend: cust.totalSpend,
          lastVisitAt: cust.lastVisitAt ? new Date(cust.lastVisitAt) : undefined,
          favoriteBarbermanId: cust.favoriteBarbermanId || undefined,
          branch: txBranch,
        },
      }).catch((e: any) => console.warn("⚠️ [checkout] Prisma customer upsert:", e?.message));

      // 2. Create transaction WITH nested items and payments (atomic & enum-safe)
      await prisma.transaction.create({
        data: {
          id: newTx.id,
          invoiceNumber: newTx.invoiceNumber,
          customerId: cust.id,
          customerName: newTx.customerName,
          customerPhone: newTx.customerPhone || undefined,
          customerInstagram: newTx.customerInstagram || undefined,
          barbermanId: newTx.barbermanId,
          subtotal: newTx.subtotal,
          discount: newTx.discount,
          grandTotal: newTx.grandTotal,
          paymentMethod: newTx.paymentMethod as any,
          paymentStatus: "PAID",
          notes: newTx.notes || undefined,
          branch: txBranch,
          items: {
            create: itemsCreated.map((item) => ({
              id: item.id,
              itemType: item.itemType as any,
              serviceId: item.serviceId || undefined,
              productId: item.productId || undefined,
              name: item.name,
              price: item.price,
              costPrice: item.costPrice || 0,
              quantity: item.quantity,
              subtotal: item.subtotal,
            })),
          },
          payments: {
            create: [
              {
                id: paymentObj.id,
                paymentMethod: paymentObj.paymentMethod as any,
                amountPaid: paymentObj.amountPaid,
                changeAmount: paymentObj.changeAmount,
                paymentRef: paymentObj.paymentRef || undefined,
              },
            ],
          },
        },
      }).catch(async (e: any) => {
        console.warn("⚠️ [checkout] Prisma transaction.create error, trying fallback:", e?.message);
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO "transactions" ("id","invoice_number","customer_id","customer_name","customer_phone","customer_instagram","barberman_id","subtotal","discount","grand_total","payment_method","payment_status","notes","branch","created_at","updated_at")
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::"PaymentMethod",$12::"PaymentStatus",$13,$14,NOW(),NOW())
             ON CONFLICT ("id") DO NOTHING`,
            newTx.id, newTx.invoiceNumber, cust.id, newTx.customerName,
            newTx.customerPhone || null, newTx.customerInstagram || null,
            newTx.barbermanId, newTx.subtotal, newTx.discount, newTx.grandTotal,
            newTx.paymentMethod, "PAID", newTx.notes || null, txBranch
          );
        } catch (rawErr: any) {
          console.warn("⚠️ [checkout] Prisma fallback also failed:", rawErr?.message);
        }
      });

      // 3. Cash transaction jika bayar tunai
      if (payload.paymentMethod === "CASH") {
        const cashEntry = memoryDB.cashTransactions[0];
        if (cashEntry) {
          await prisma.cashTransaction.create({
            data: {
              id: cashEntry.id,
              type: "CASH_IN",
              category: "Penjualan Kasir",
              amount: payload.grandTotal,
              description: `Pembayaran Cash Kasir ${invoiceNumber} (${payload.customerName})`,
              source: "POS_SALE",
              transactionId: newTx.id,
              branch: txBranch,
            },
          }).catch(() => {});
        }
      }
    }
  } catch (e: any) {
    console.warn("⚠️ [processCheckout] Prisma dual-write error (data tetap aman di lokal):", e?.message);
  }

  saveLocalDB();

  return {
    ...newTx,
    items: itemsCreated,
    payments: [paymentObj],
    barberman: barber,
  };
}

// -------------------------------------------------------------
// TRANSACTIONS QUERY (Mendukung filter cabang & limit)
// -------------------------------------------------------------
export async function getTransactions(branch?: string, limit?: number) {
  await initMemoryDBIfNeeded();

  const dbUrl = process.env.DATABASE_URL || "";
  const hasPersistentDb = !!dbUrl && !dbUrl.includes("[YOUR-") && !dbUrl.includes("placeholder");

  // 🔑 Supabase mode: query Prisma LANGSUNG (tidak pakai memory DB)
  if (hasPersistentDb) {
    const where: any = {};
    if (branch && branch !== "All") {
      where.branch = branch;
    }
    const rows = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit && limit > 0 ? limit : undefined,
      include: {
        items: true,
        payments: true,
        barberman: true,
        customer: true,
      },
    });
    return rows.map((t: any) => ({
      ...t,
      branch: t.branch || "Telkom",
    }));
  }

  // Local dev: baca dari memory DB
  syncFromLocalDB();
  let list = [...(memoryDB.transactions || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (branch && branch !== "All") {
    list = list.filter((t) => t.branch === branch);
  }

  if (limit && limit > 0) {
    list = list.slice(0, limit);
  }

  return list.map((t) => ({
    ...t,
    barberman: (memoryDB.barbermen || []).find((b) => b.id === t.barbermanId) || null,
    items: (memoryDB.transactionItems || []).filter((i) => i.transactionId === t.id),
    payments: (memoryDB.payments || []).filter((p) => p.transactionId === t.id),
    customer: (memoryDB.customers || []).find((c) => c.id === t.customerId) || null,
  }));
}


// -------------------------------------------------------------
// CASH MANAGEMENT
// Rumus: Cash Awal + Cash Masuk - Cash Keluar = Cash Saat Ini
// -------------------------------------------------------------

export async function getCashLedger(branch?: string) {
  await initMemoryDBIfNeeded();

  const dbUrl = process.env.DATABASE_URL || "";
  const hasPersistentDb = !!dbUrl && !dbUrl.includes("[YOUR-") && !dbUrl.includes("placeholder");

  let rawList: any[];
  let initialFloatTelkom: number;
  let initialFloatSuta: number;

  if (hasPersistentDb) {
    // Query Prisma langsung
    rawList = await prisma.cashTransaction.findMany({
      orderBy: { createdAt: "desc" },
    }).catch(() => []);
    const settings = await prisma.shopSetting.findFirst().catch(() => null);
    initialFloatTelkom = (settings as any)?.initialCashFloatTelkom ?? settings?.initialCashFloat ?? 100000;
    initialFloatSuta = (settings as any)?.initialCashFloatSuta ?? settings?.initialCashFloat ?? 100000;
  } else {
    syncFromLocalDB();
    rawList = [...memoryDB.cashTransactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    initialFloatTelkom = memoryDB.shopSettings?.initialCashFloatTelkom ?? 100000;
    initialFloatSuta = memoryDB.shopSettings?.initialCashFloatSuta ?? 100000;
  }

  const list = rawList;
  const initialFloatTotal = initialFloatTelkom + initialFloatSuta;

  if (branch && branch !== "All") {
    const filtered = list.filter((c) => !c.branch || c.branch === branch || c.branch === "All");
    const activeFloat = branch === "Suta" ? initialFloatSuta : initialFloatTelkom;

    let totalCashIn = 0;
    let totalCashOut = 0;
    let physicalCashIn = 0;
    let qrisIncome = 0;

    for (const item of filtered) {
      const isInitFloat =
        item.category === "Modal Awal" ||
        item.id === "csh_init" ||
        item.description?.toLowerCase().includes("modal awal");
      if (item.type === "CASH_IN" && !isInitFloat) {
        totalCashIn += item.amount;
        if (item.paymentMethod === "QRIS") {
          qrisIncome += item.amount;
        } else {
          physicalCashIn += item.amount;
        }
      } else if (item.type === "CASH_OUT") {
        totalCashOut += item.amount;
      }
    }
    const cashInHand = activeFloat + physicalCashIn - totalCashOut;
    const systemCash = activeFloat + totalCashIn - totalCashOut;
    return {
      branch,
      initialFloat: activeFloat,
      totalCashIn,
      physicalCashIn,
      qrisIncome,
      totalCashOut,
      cashInHand,
      systemCash,
      transactions: filtered,
    };
  }

  // Gabungan kedua cabang (Owner)
  let totalCashIn = 0;
  let totalCashOut = 0;
  let totalPhysicalCashIn = 0;
  let totalQrisIncome = 0;

  let telkomCashIn = 0;
  let telkomPhysicalIn = 0;
  let telkomQrisIn = 0;
  let telkomCashOut = 0;

  let sutaCashIn = 0;
  let sutaPhysicalIn = 0;
  let sutaQrisIn = 0;
  let sutaCashOut = 0;

  for (const item of list) {
    const isInitFloat =
      item.category === "Modal Awal" ||
      item.id === "csh_init" ||
      item.description?.toLowerCase().includes("modal awal");
    if (item.type === "CASH_IN" && !isInitFloat) {
      totalCashIn += item.amount;
      const isQR = item.paymentMethod === "QRIS";
      if (isQR) totalQrisIncome += item.amount;
      else totalPhysicalCashIn += item.amount;

      if (item.branch === "Suta") {
        sutaCashIn += item.amount;
        if (isQR) sutaQrisIn += item.amount;
        else sutaPhysicalIn += item.amount;
      } else {
        telkomCashIn += item.amount;
        if (isQR) telkomQrisIn += item.amount;
        else telkomPhysicalIn += item.amount;
      }
    } else if (item.type === "CASH_OUT") {
      totalCashOut += item.amount;
      if (item.branch === "Suta") sutaCashOut += item.amount;
      else telkomCashOut += item.amount;
    }
  }

  const telkomCashInHand = initialFloatTelkom + telkomPhysicalIn - telkomCashOut;
  const sutaCashInHand = initialFloatSuta + sutaPhysicalIn - sutaCashOut;

  const telkomCash = initialFloatTelkom + telkomCashIn - telkomCashOut;
  const sutaCash = initialFloatSuta + sutaCashIn - sutaCashOut;
  const systemCash = initialFloatTotal + totalCashIn - totalCashOut;
  const totalCashInHand = initialFloatTotal + totalPhysicalCashIn - totalCashOut;

  return {
    branch: "All",
    initialFloat: initialFloatTotal,
    totalCashIn,
    totalPhysicalCashIn,
    totalQrisIncome,
    totalCashOut,
    systemCash,
    totalCashInHand,
    telkomCash,
    telkomCashInHand,
    telkomQrisIn,
    sutaCash,
    sutaCashInHand,
    sutaQrisIn,
    transactions: list,
  };
}

export async function createCashEntry(data: {
  type: "CASH_IN" | "CASH_OUT";
  category: string;
  amount: number;
  description: string;
  source?: string;
  branch?: string;
}) {
  await initMemoryDBIfNeeded();
  const entry = {
    id: `csh_${Date.now()}`,
    type: data.type,
    category: data.category,
    amount: data.amount,
    description: data.description,
    source: data.source || "MANUAL",
    branch: data.branch || "Telkom",
    createdAt: new Date(),
  };
  memoryDB.cashTransactions.unshift(entry);

  await recordActivity({
    action: "CASH_MANAGEMENT",
    description: `Catat kas ${data.type === "CASH_IN" ? "Masuk" : "Keluar"} Rp ${data.amount.toLocaleString("id-ID")} (${data.category} - ${data.description}) di Cabang ${entry.branch}`,
    branch: entry.branch,
    actor: "Admin",
  });

  // DUAL-WRITE ke Supabase
  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("[YOUR-")) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "cash_transactions" ("id","type","category","amount","description","source","branch","created_at")
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
         ON CONFLICT ("id") DO NOTHING`,
        entry.id,
        entry.type,
        entry.category,
        entry.amount,
        entry.description,
        entry.source,
        entry.branch
      ).catch((e: any) => console.warn("⚠️ [createCashEntry] Prisma insert:", e?.message));
    }
  } catch {}

  saveLocalDB();
  return entry;
}

// -------------------------------------------------------------
// DASHBOARD & PERFORMA BARBERMAN STATS
// -------------------------------------------------------------

export async function getDashboardData(
  filter: "today" | "yesterday" | "week" | "month" | "year" | "custom" = "today",
  customStart?: string,
  customEnd?: string,
  branch?: string
) {
  await initMemoryDBIfNeeded();

  const dbUrl = process.env.DATABASE_URL || "";
  const hasPersistentDb = !!dbUrl && !dbUrl.includes("[YOUR-") && !dbUrl.includes("placeholder");

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

  // 🔑 Supabase mode: query Prisma LANGSUNG (CEPAT & AMAN DARI ERROR KOLOM)
  if (hasPersistentDb) {
    const [
      txsPeriod,
      txsMonth,
      bookingsCount,
      membersCount,
      productsList,
      cashTxs,
      allBarbers,
      settings,
    ] = await Promise.all([
      // Transaksi periode terpilih
      prisma.transaction.findMany({
        where: { createdAt: { gte: startDate, lte: endDate } },
        select: {
          id: true,
          grandTotal: true,
          branch: true,
          barbermanId: true,
          customerId: true,
          customerName: true,
          paymentMethod: true,
        },
      }).catch(() => []),

      // Transaksi bulan ini (hanya butuh grandTotal & branch)
      prisma.transaction.findMany({
        where: { createdAt: { gte: startMonth, lte: endMonth } },
        select: {
          grandTotal: true,
          branch: true,
        },
      }).catch(() => []),

      // Booking hari ini
      prisma.booking.count({
        where: { bookingDate: { gte: startOfDay(now), lte: endOfDay(now) } },
      }).catch(() => 0),

      // Total member aktif
      prisma.member.count({ where: { status: "ACTIVE" } }).catch(() => 0),

      // Produk aktif
      prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, stock: true, minStock: true },
      }).catch(() => []),

      // Cash transactions
      prisma.cashTransaction.findMany().catch(() => []),

      // Semua barber aktif
      prisma.barberman.findMany({ where: { isActive: true } }).catch(() => []),

      // Shop settings
      prisma.shopSetting.findFirst().catch(() => null),
    ]);

    const initFloatTelkom = (settings as any)?.initialCashFloatTelkom ?? (settings as any)?.initialCashFloat ?? 100000;
    const initFloatSuta   = (settings as any)?.initialCashFloatSuta   ?? (settings as any)?.initialCashFloat ?? 100000;

    const calcBranchStatsDirect = (bFilter?: string) => {
      const txs = !bFilter || bFilter === "All" ? txsPeriod : txsPeriod.filter((t: any) => t.branch === bFilter);
      const mtxs = !bFilter || bFilter === "All" ? txsMonth : txsMonth.filter((t: any) => t.branch === bFilter);

      const revenue = txs.reduce((sum: number, t: any) => sum + Number(t.grandTotal || 0), 0);
      const monthRevenue = mtxs.reduce((sum: number, t: any) => sum + Number(t.grandTotal || 0), 0);

      // Low stock
      const lowStock = productsList.filter((p: any) => Number(p.stock || 0) <= Number(p.minStock || 5)).length;

      // Cash calculation
      let cashIn = 0, cashOut = 0;
      for (const c of cashTxs) {
        if (bFilter && bFilter !== "All" && c.branch && c.branch !== bFilter) continue;
        if (c.type === "CASH_IN") cashIn += Number(c.amount || 0);
        else if (c.type === "CASH_OUT") cashOut += Number(c.amount || 0);
      }
      for (const t of txs) {
        if (t.paymentMethod !== "QRIS") {
          cashIn += Number(t.grandTotal || 0);
        }
      }
      const initF = bFilter === "Suta" ? initFloatSuta : bFilter === "Telkom" ? initFloatTelkom : (initFloatTelkom + initFloatSuta);
      const cashInHand = initF + cashIn - cashOut;

      return {
        todayCustomer: txs.length,
        todayTransaction: txs.length,
        todayRevenue: revenue,
        monthRevenue,
        todayBooking: Number(bookingsCount || 0),
        totalMember: Number(membersCount || 0),
        totalProduct: productsList.length,
        lowStockProducts: lowStock,
        productSalesRevenue: 0,
        cashInHand,
      };
    };

    // Barber performance
    const barberPerformance = allBarbers.map((barber: any) => {
      const bTxs = txsPeriod.filter((t: any) => {
        if (t.barbermanId !== barber.id) return false;
        if (branch && branch !== "All") return t.branch === branch;
        return true;
      });
      const uniqueCust = new Set(bTxs.map((t: any) => t.customerId || t.customerName)).size;
      const bOmzet = bTxs.reduce((sum: number, t: any) => sum + Number(t.grandTotal || 0), 0);
      const wBranch = barber.workingBranch || barber.branch || "Telkom";
      return {
        id: barber.id,
        name: barber.name,
        nickname: barber.nickname || barber.name,
        homeBranch: barber.homeBranch || barber.branch || "Telkom",
        workingBranch: wBranch,
        branch: wBranch,
        status: barber.status || "AKTIF",
        customers: uniqueCust,
        transactions: bTxs.length,
        services: bTxs.length,
        omzet: bOmzet,
      };
    });

    if (branch && branch !== "All") {
      const bkCount = await prisma.booking.count({
        where: {
          bookingDate: { gte: startOfDay(now), lte: endOfDay(now) },
          barberman: { workingBranch: branch },
        },
      }).catch(() => 0);
      const metrics = calcBranchStatsDirect(branch);
      metrics.todayBooking = bkCount;
      return {
        filter,
        branch,
        metrics,
        barberPerformance: barberPerformance.filter((b: any) => b.workingBranch === branch || b.branch === branch),
        recentActivities: [],
      };
    }

    const [bkTelkom, bkSuta] = await Promise.all([
      prisma.booking.count({ where: { bookingDate: { gte: startOfDay(now), lte: endOfDay(now) }, barberman: { workingBranch: "Telkom" } } }).catch(() => 0),
      prisma.booking.count({ where: { bookingDate: { gte: startOfDay(now), lte: endOfDay(now) }, barberman: { workingBranch: "Suta" } } }).catch(() => 0),
    ]);

    const telkomMetrics = calcBranchStatsDirect("Telkom");
    const sutaMetrics   = calcBranchStatsDirect("Suta");
    const totalMetrics  = calcBranchStatsDirect("All");
    telkomMetrics.todayBooking = bkTelkom;
    sutaMetrics.todayBooking   = bkSuta;
    totalMetrics.todayBooking  = bkTelkom + bkSuta;

    return {
      filter,
      branch: "All",
      metrics: totalMetrics,
      telkomMetrics,
      sutaMetrics,
      totalMetrics,
      barberPerformance,
      recentActivities: [],
    };
  }


  // ─── Local dev: baca dari memory DB ───────────────────────────────────────
  syncFromLocalDB();



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
    const uniqueCust = new Set(bTxs.map((t: any) => t.customerId || t.customerName)).size;
    const bTrans = bTxs.length;
    const txIds = new Set(bTxs.map((t: any) => t.id));
    const serviceItems = (memoryDB.transactionItems || []).filter(
      (ti: any) => txIds.has(ti.transactionId) && ti.itemType !== "PRODUCT"
    );
    const bServices = serviceItems.length > 0
      ? serviceItems.reduce((acc: number, ti: any) => acc + (ti.quantity || 1), 0)
      : bTrans;
    const bOmzet = bTxs.reduce((acc: number, t: any) => acc + (t.grandTotal || 0), 0);

    return {
      id: barber.id,
      name: barber.name,
      nickname: barber.nickname,
      homeBranch: barber.homeBranch,
      workingBranch: barber.workingBranch,
      branch: barber.workingBranch,
      status: barber.status,
      customers: uniqueCust,
      transactions: bTrans,
      services: bServices,
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

// -------------------------------------------------------------
// LAPORAN KHUSUS (Pomade, Tonic & Powder, Harian, Bulanan, Tahunan)

// -------------------------------------------------------------

export async function getCategoryReport(categorySlug: string | string[], startDate?: Date, endDate?: Date, branch?: string) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();

  const slugs = Array.isArray(categorySlug) ? categorySlug : [categorySlug];
  const catIds = (memoryDB.categories || []).filter((c) => slugs.includes(c.slug)).map((c) => c.id);
  const prods = (memoryDB.products || []).filter((p) => catIds.includes(p.categoryId));

  let totalSold = 0;
  let totalOmzet = 0;
  let totalModal = 0;
  let currentStock = 0;
  const productStats: any[] = [];

  for (const prod of prods) {
    const prodStock = branch === "Suta" ? (prod.stockSuta ?? prod.stock) : branch === "Telkom" ? (prod.stockTelkom ?? prod.stock) : (prod.stock || 0);
    currentStock += prodStock;
    const cat = (memoryDB.categories || []).find((c) => c.id === prod.categoryId);
    const items = (memoryDB.transactionItems || []).filter((i) => {
      if (i.productId !== prod.id) return false;
      const tx = (memoryDB.transactions || []).find((t) => t.id === i.transactionId);
      if (!tx) return false;
      if (branch && branch !== "All" && tx.branch !== branch) return false;
      if (startDate || endDate) {
        const d = new Date(tx.createdAt);
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
      }
      return true;
    });

    let prodSold = 0;
    let prodOmzet = 0;
    let prodModal = 0;

    for (const it of items) {
      prodSold += it.quantity;
      prodOmzet += it.subtotal;
      prodModal += (it.costPrice || prod.costPrice || 0) * it.quantity;
    }

    totalSold += prodSold;
    totalOmzet += prodOmzet;
    totalModal += prodModal;

    productStats.push({
      id: prod.id,
      sku: prod.sku,
      name: prod.name,
      categoryName: cat?.name || "Produk",
      sellingPrice: prod.sellingPrice,
      costPrice: prod.costPrice,
      stock: prodStock,
      sold: prodSold,
      omzet: prodOmzet,
      modal: prodModal,
      profit: prodOmzet - prodModal,
    });
  }

  productStats.sort((a, b) => b.sold - a.sold);

  return {
    categorySlugs: slugs,
    totalSold,
    totalOmzet,
    totalModal,
    totalProfit: totalOmzet - totalModal,
    currentStock,
    topProducts: productStats,
  };
}

export async function getDailyReport(dateStr?: string, branch?: string) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();

  let targetDate = new Date();
  if (dateStr) {
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3) {
      targetDate = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
    } else {
      targetDate = new Date(dateStr);
    }
  }
  const start = startOfDay(targetDate);
  const end = endOfDay(targetDate);

  const [pomadeReport, tonicPowderReport] = await Promise.all([
    getCategoryReport("pomade", start, end, branch),
    getCategoryReport(["tonic", "powder"], start, end, branch),
  ]);

  let txs = (memoryDB.transactions || [])
    .filter((t) => {
      const d = new Date(t.createdAt);
      return d >= start && d <= end;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (branch && branch !== "All") {
    txs = txs.filter((t) => t.branch === branch);
  }

  let serviceSales = 0;
  let productSales = 0;
  let totalOmzet = 0;

  for (const tx of txs) {
    totalOmzet += tx.grandTotal || 0;
    const items = (memoryDB.transactionItems || []).filter((i) => i.transactionId === tx.id);
    for (const item of items) {
      if (item.itemType === "SERVICE") serviceSales += (item.subtotal || 0);
      else if (item.itemType === "PRODUCT") productSales += (item.subtotal || 0);
    }
  }

  let cashEntries = (memoryDB.cashTransactions || []).filter((c) => {
    const d = new Date(c.createdAt);
    return d >= start && d <= end;
  });
  if (branch && branch !== "All") {
    cashEntries = cashEntries.filter((c) => !c.branch || c.branch === branch || c.branch === "All");
  }

  let cashIn = 0;
  let cashOut = 0;
  for (const c of cashEntries) {
    if (c.type === "CASH_IN") cashIn += (c.amount || 0);
    else if (c.type === "CASH_OUT") cashOut += (c.amount || 0);
  }

  let barberList = (memoryDB.barbermen || []).filter((b) => b.isActive);
  if (branch && branch !== "All") {
    barberList = barberList.filter((b) => (b.workingBranch || b.branch) === branch);
  }

  const barbermanStats = barberList.map((b) => {
    const bTxs = txs.filter((t) => t.barbermanId === b.id);
    const bOmzet = bTxs.reduce((sum, t) => sum + (t.grandTotal || 0), 0);
    const uniqueCust = new Set(bTxs.map((t) => t.customerId || t.customerName)).size;
    let srvCount = 0;
    for (const t of bTxs) {
      const items = (memoryDB.transactionItems || []).filter((i) => i.transactionId === t.id);
      for (const it of items) {
        if (it.itemType === "SERVICE") srvCount += (it.quantity || 1);
      }
    }
    return {
      id: b.id,
      name: b.name,
      customerCount: uniqueCust,
      transactionCount: bTxs.length,
      serviceCount: srvCount,
      omzet: bOmzet,
    };
  });

  let bookingsList = (memoryDB.bookings || []).filter((b) => {
    const d = new Date(b.bookingDate);
    return d >= start && d <= end;
  });
  if (branch && branch !== "All") {
    bookingsList = bookingsList.filter((b) => b.branch === branch);
  }

  const newMembersCount = (memoryDB.members || []).filter((m) => {
    const d = new Date(m.createdAt);
    return d >= start && d <= end;
  }).length;

  return {
    date: format(targetDate, "yyyy-MM-dd"),
    branch: branch || "All",
    totalCustomers: txs.length,
    totalTransactions: txs.length,
    totalOmzet,
    serviceSales,
    productSales,
    pomadeSold: pomadeReport.totalSold,
    pomadeOmzet: pomadeReport.totalOmzet,
    tonicPowderSold: tonicPowderReport.totalSold,
    tonicPowderOmzet: tonicPowderReport.totalOmzet,
    cashIn,
    cashOut,
    cashEnding: cashIn - cashOut,
    bookingsCount: bookingsList.length,
    newMembersCount,
    barbermanPerformance: barbermanStats,
    transactions: txs.map((t) => ({
      ...t,
      barberman: (memoryDB.barbermen || []).find((b) => b.id === t.barbermanId) || null,
      items: (memoryDB.transactionItems || []).filter((i) => i.transactionId === t.id),
      payments: (memoryDB.payments || []).filter((p) => p.transactionId === t.id),
    })),
  };
}

export async function getAnnualReport(year: number = new Date().getFullYear(), branch?: string) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();

  const monthsData = [];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  for (let m = 0; m < 12; m++) {
    let txs = (memoryDB.transactions || []).filter((t) => {
      const d = new Date(t.createdAt);
      return d.getFullYear() === year && d.getMonth() === m;
    });

    if (branch && branch !== "All") {
      txs = txs.filter((t) => t.branch === branch);
    }

    let omzet = 0;
    let productOmzet = 0;
    for (const t of txs) {
      omzet += t.grandTotal || 0;
      const items = (memoryDB.transactionItems || []).filter((i) => i.transactionId === t.id);
      for (const it of items) {
        if (it.itemType === "PRODUCT") productOmzet += (it.subtotal || 0);
      }
    }

    monthsData.push({
      month: monthNames[m],
      monthNumber: m + 1,
      customer: txs.length,
      transactions: txs.length,
      omzet,
      productOmzet,
    });
  }

  const totalOmzet = monthsData.reduce((s, m) => s + m.omzet, 0);
  const totalCustomer = monthsData.reduce((s, m) => s + m.customer, 0);
  const totalTransactions = monthsData.reduce((s, m) => s + m.transactions, 0);
  const totalProductSales = monthsData.reduce((s, m) => s + m.productOmzet, 0);

  return {
    year,
    branch: branch || "All",
    months: monthsData,
    summary: {
      totalOmzet,
      totalCustomer,
      totalTransactions,
      totalProductSales,
    },
  };
}

export async function getMonthlyReport(yearNum?: number, monthNum?: number, branch?: string) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();

  const now = new Date();
  const year = yearNum ?? now.getFullYear();
  const month = monthNum ?? now.getMonth(); // 0-indexed

  const startM = new Date(year, month, 1, 0, 0, 0);
  const endM = endOfMonth(startM);

  let txs = (memoryDB.transactions || []).filter((t) => {
    const d = new Date(t.createdAt);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  if (branch && branch !== "All") {
    txs = txs.filter((t) => t.branch === branch);
  }

  let totalOmzet = 0;
  let serviceSales = 0;
  let productSales = 0;
  let productCost = 0;

  const paymentMap: Record<string, { count: number; total: number }> = {
    CASH: { count: 0, total: 0 },
    QRIS: { count: 0, total: 0 },
    TRANSFER: { count: 0, total: 0 },
    DEBIT: { count: 0, total: 0 },
  };

  const serviceMap: Record<string, { name: string; category: string; count: number; omzet: number }> = {};
  const productMap: Record<string, { name: string; sku: string; category: string; count: number; omzet: number; modal: number; stock: number }> = {};

  for (const tx of txs) {
    totalOmzet += tx.grandTotal || 0;

    const pm = (tx.paymentMethod || "CASH").toUpperCase();
    if (!paymentMap[pm]) paymentMap[pm] = { count: 0, total: 0 };
    paymentMap[pm].count += 1;
    paymentMap[pm].total += (tx.grandTotal || 0);

    const items = (memoryDB.transactionItems || []).filter((i) => i.transactionId === tx.id);
    for (const it of items) {
      if (it.itemType === "SERVICE") {
        serviceSales += (it.subtotal || 0);
        if (!serviceMap[it.name]) {
          serviceMap[it.name] = { name: it.name, category: "Haircut & Grooming", count: 0, omzet: 0 };
        }
        serviceMap[it.name].count += (it.quantity || 1);
        serviceMap[it.name].omzet += (it.subtotal || 0);
      } else if (it.itemType === "PRODUCT") {
        productSales += (it.subtotal || 0);
        const itemCost = (it.costPrice || 0) * (it.quantity || 1);
        productCost += itemCost;

        if (!productMap[it.name]) {
          const pObj = (memoryDB.products || []).find((p) => p.name === it.name || p.id === it.productId);
          const pStock = branch === "Suta" ? (pObj?.stockSuta ?? pObj?.stock) : branch === "Telkom" ? (pObj?.stockTelkom ?? pObj?.stock) : (pObj?.stock || 0);
          productMap[it.name] = {
            name: it.name,
            sku: pObj?.sku || "-",
            category: "Retail Grooming",
            count: 0,
            omzet: 0,
            modal: 0,
            stock: pStock,
          };
        }
        productMap[it.name].count += (it.quantity || 1);
        productMap[it.name].omzet += (it.subtotal || 0);
        productMap[it.name].modal += itemCost;
      }
    }
  }

  let cashEntries = (memoryDB.cashTransactions || []).filter((c) => {
    const d = new Date(c.createdAt);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  if (branch && branch !== "All") {
    cashEntries = cashEntries.filter((c) => !c.branch || c.branch === branch || c.branch === "All");
  }

  let cashIn = 0;
  let cashOut = 0;
  const expensesList: any[] = [];

  for (const c of cashEntries) {
    if (c.type === "CASH_IN") {
      cashIn += (c.amount || 0);
    } else if (c.type === "CASH_OUT") {
      cashOut += (c.amount || 0);
      expensesList.push({
        id: c.id,
        category: c.category || "Operasional",
        description: c.description,
        amount: c.amount,
        date: format(new Date(c.createdAt), "yyyy-MM-dd HH:mm"),
      });
    }
  }

  const grossProfit = serviceSales + (productSales - productCost);
  const netOperatingIncome = grossProfit - cashOut;

  let barberList = (memoryDB.barbermen || []).filter((b) => b.isActive);
  if (branch && branch !== "All") {
    barberList = barberList.filter((b) => (b.workingBranch || b.branch) === branch);
  }

  const barbermanStats = barberList.map((b) => {
    const bTxs = txs.filter((t) => t.barbermanId === b.id);
    const bOmzet = bTxs.reduce((sum, t) => sum + (t.grandTotal || 0), 0);
    const bCust = new Set(bTxs.map((t) => t.customerId || t.customerName)).size;
    const bTrans = bTxs.length;
    return {
      id: b.id,
      name: b.name,
      customerCount: bCust,
      transactionCount: bTrans,
      omzet: bOmzet,
      averagePerCustomer: bCust > 0 ? Math.round(bOmzet / bCust) : 0,
      contributionPercentage: totalOmzet > 0 ? Number(((bOmzet / totalOmzet) * 100).toFixed(1)) : 0,
    };
  });

  const paymentsBreakdown = Object.entries(paymentMap).map(([method, val]) => ({
    method,
    transactionCount: val.count,
    totalAmount: val.total,
    percentage: totalOmzet > 0 ? Number(((val.total / totalOmzet) * 100).toFixed(1)) : 0,
  }));

  const topServices = Object.values(serviceMap).sort((a, b) => b.omzet - a.omzet);
  const topProducts = Object.values(productMap).map((p) => ({
    ...p,
    profit: p.omzet - p.modal,
  })).sort((a, b) => b.omzet - a.omzet);

  return {
    year,
    month: month + 1,
    monthName: format(startM, "MMMM yyyy"),
    branch: branch || "All",
    totalCustomers: txs.length,
    totalTransactions: txs.length,
    totalOmzet,
    serviceSales,
    productSales,
    productCost,
    grossProfit,
    cashExpenses: cashOut,
    netOperatingIncome,
    cashIn,
    cashOut,
    cashEnding: cashIn - cashOut,
    averageTicketSize: txs.length > 0 ? Math.round(totalOmzet / txs.length) : 0,
    barbermanPerformance: barbermanStats,
    paymentsBreakdown,
    topServices,
    topProducts,
    expensesList,
  };
}


// -------------------------------------------------------------
// LOG AKTIVITAS (ACTIVITY LOG MULTI-CABANG)
// -------------------------------------------------------------
export async function recordActivity(data: {
  action: string;
  description: string;
  branch?: string;
  actor?: string;
  details?: any;
}) {
  await initMemoryDBIfNeeded();
  const activity = {
    id: "act_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    action: data.action,
    description: data.description,
    branch: data.branch || "All",
    actor: data.actor || "Sistem",
    details: data.details || null,
    createdAt: new Date().toISOString(),
  };
  if (!memoryDB.activities) memoryDB.activities = [];
  memoryDB.activities.unshift(activity);
  saveLocalDB();
  return activity;
}

export async function getActivities(branch?: string) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();
  let list = memoryDB.activities || [];
  if (branch && branch !== "All") {
    list = list.filter((a: any) => a.branch === branch || a.branch === "All");
  }
  return list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// -------------------------------------------------------------
// PENUGASAN BARBERMAN (BARBER ASSIGNMENT / DIPERBANTUKAN)
// -------------------------------------------------------------
export async function assignBarberman(data: {
  barbermanId: string;
  targetBranch: string; // "Telkom" | "Suta"
  startDate?: string;
  endDate?: string;
  notes?: string;
  assignedBy?: string;
}) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();

  const barber = memoryDB.barbermen.find((b: any) => b.id === data.barbermanId);
  if (!barber) throw new Error("Barberman tidak ditemukan");

  const sutaNames = ["ade", "arif", "akmal"];
  if (!barber.homeBranch) {
    barber.homeBranch = sutaNames.some((n) => (barber.name || "").toLowerCase().includes(n)) ? "Suta" : "Telkom";
  }

  barber.workingBranch = data.targetBranch;
  barber.branch = data.targetBranch;
  barber.isActive = true;
  barber.status = data.targetBranch === barber.homeBranch ? "AKTIF" : "DIPERBANTUKAN";

  const assignment = {
    id: "asg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    barbermanId: barber.id,
    barbermanName: barber.name,
    homeBranch: barber.homeBranch,
    workingBranch: data.targetBranch,
    startDate: data.startDate || new Date().toISOString().split("T")[0],
    endDate: data.endDate || null,
    notes: data.notes || ("Penugasan " + barber.name + " ke Cabang " + data.targetBranch),
    status: barber.status,
    createdBy: data.assignedBy || "Admin",
    createdAt: new Date().toISOString(),
  };

  if (!memoryDB.barberAssignments) memoryDB.barberAssignments = [];
  memoryDB.barberAssignments.unshift(assignment);

  await recordActivity({
    action: "PENUGASAN_BARBER",
    description: barber.name + " (Cabang asal: " + barber.homeBranch + ") ditugaskan ke Cabang " + data.targetBranch + " (Status: " + barber.status + ")",
    branch: data.targetBranch,
    actor: data.assignedBy || "Admin",
  });

  // DUAL-WRITE ke Supabase
  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("[YOUR-")) {
      await prisma.barberman.update({
        where: { id: barber.id },
        data: {
          branch: data.targetBranch,
        },
      }).catch(() => {});

      await prisma.$executeRawUnsafe(
        `UPDATE "barbermen" SET "branch" = $1, "working_branch" = $1, "status" = $2 WHERE "id" = $3`,
        data.targetBranch,
        barber.status,
        barber.id
      ).catch((e: any) => console.warn("⚠️ [assignBarberman] Prisma update:", e?.message));
    }
  } catch {}

  saveLocalDB();
  return { barber, assignment };
}

export async function getBarberAssignments(branch?: string) {
  await initMemoryDBIfNeeded();
  syncFromLocalDB();
  let list = memoryDB.barberAssignments || [];
  if (branch && branch !== "All") {
    list = list.filter((a: any) => a.workingBranch === branch || a.homeBranch === branch);
  }
  return list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
