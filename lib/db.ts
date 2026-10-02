import prisma from "./prisma";
import bcrypt from "bcryptjs";
import { format, subDays } from "date-fns";
import fs from "fs";
import path from "path";

// Memory storage fallback jika PostgreSQL belum dikonfigurasi saat preview lokal
export interface InMemoryDB {
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

  if (db.customers && Array.isArray(db.customers)) {
    for (const c of db.customers) {
      if (!c.branch) c.branch = "Telkom";
    }
  }

  if (db.barbermen && Array.isArray(db.barbermen)) {
    const sutaBarberNames = ["ade", "arif", "akmal"];
    for (const b of db.barbermen) {
      const lower = (b.name || "").toLowerCase();
      if (!b.homeBranch) {
        b.homeBranch = sutaBarberNames.some((n) => lower.includes(n)) ? "Suta" : "Telkom";
      }
      if (!b.workingBranch) {
        b.workingBranch = b.branch || b.homeBranch;
      }
      b.branch = b.workingBranch;
      if (b.isActive === false) {
        b.status = "LIBUR";
      } else if (b.workingBranch !== b.homeBranch) {
        b.status = "DIPERBANTUKAN";
      } else {
        b.status = "AKTIF";
      }
    }
  }

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

  db.users = db.users.filter((u: any) => u.username?.toLowerCase() !== "admin");
}

const globalForSchema = globalThis as unknown as { __ad_schema_ensured?: boolean };

export async function ensureSupabaseSchema(): Promise<void> {
  if (globalForSchema.__ad_schema_ensured) return;
  if (!process.env.DATABASE_URL) {
    globalForSchema.__ad_schema_ensured = true;
    return;
  }
  globalForSchema.__ad_schema_ensured = true;

  try {
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

    const passwordHash = "$2a$10$cS0SEMAI7ePLiuHs/VlGv.H0weDyjirNgwDGA16tWZewUErJADc7i";
    const defaultUsers = [
      { id: "usr_owner", username: "owner", email: "owner@adbarbershop.com", passwordHash, name: "Owner AD Barbershop", role: "OWNER", branch: "All" },
      { id: "usr_admin_telkom", username: "admin_telkom", email: "telkom@adbarbershop.com", passwordHash, name: "Admin Telkom", role: "ADMIN_TELKOM", branch: "Telkom" },
      { id: "usr_admin_suta", username: "admin_suta", email: "suta@adbarbershop.com", passwordHash, name: "Admin Suta", role: "ADMIN_SUTA", branch: "Suta" },
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

    const barbermanCount = await prisma.barberman.count().catch(() => 0);
    if (barbermanCount === 0) {
      const defaultBarbermen = [
        { id: "brb_ari", name: "Ari", nickname: "Bang Ari", phone: "081200004444", isActive: true, branch: "Telkom" },
        { id: "brb_dani", name: "Dani", nickname: "Bang Dani", phone: "081255556666", isActive: true, branch: "Telkom" },
        { id: "brb_azis", name: "Azis", nickname: "Bang Azis", phone: "081233334444", isActive: true, branch: "Telkom" },
        { id: "brb_ade", name: "Ade", nickname: "Bang Ade", phone: "081200001111", isActive: true, branch: "Suta" },
        { id: "brb_arif", name: "Arif", nickname: "Bang Arif", phone: "081200002222", isActive: true, branch: "Suta" },
        { id: "brb_akmal", name: "Akmal", nickname: "Bang Akmal", phone: "081200003333", isActive: true, branch: "Suta" },
      ];
      for (const b of defaultBarbermen) {
        try { await prisma.barberman.create({ data: b }); } catch {}
      }
    }

    console.log("✅ ensureSupabaseSchema: selesai");
  } catch (err: any) {
    console.warn("⚠️ ensureSupabaseSchema error:", err?.message);
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
    { id: "usr_owner", username: "owner", email: "owner@adbarbershop.com", passwordHash, name: "Owner AD Barbershop", role: "OWNER", branch: "All" },
    { id: "usr_admin_telkom", username: "admin_telkom", email: "telkom@adbarbershop.com", passwordHash, name: "Admin Telkom", role: "ADMIN_TELKOM", branch: "Telkom" },
    { id: "usr_admin_suta", username: "admin_suta", email: "suta@adbarbershop.com", passwordHash, name: "Admin Suta", role: "ADMIN_SUTA", branch: "Suta" },
  ];

  memoryDB.barbermen = [
    { id: "brb_ari", name: "Ari", nickname: "Bang Ari", phone: "081200004444", isActive: true, branch: "Telkom" },
    { id: "brb_dani", name: "Dani", nickname: "Bang Dani", phone: "081255556666", isActive: true, branch: "Telkom" },
    { id: "brb_azis", name: "Azis", nickname: "Bang Azis", phone: "081233334444", isActive: true, branch: "Telkom" },
    { id: "brb_ade", name: "Ade", nickname: "Bang Ade", phone: "081200001111", isActive: true, branch: "Suta" },
    { id: "brb_arif", name: "Arif", nickname: "Bang Arif", phone: "081200002222", isActive: true, branch: "Suta" },
    { id: "brb_akmal", name: "Akmal", nickname: "Bang Akmal", phone: "081200003333", isActive: true, branch: "Suta" },
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
  ];

  memoryDB.products = [
    { id: "prd_pomade_01", categoryId: "cat_pomade", sku: "POM-SUV-01", name: "Suavecito Matte Pomade 4oz", costPrice: 85000, sellingPrice: 130000, stock: 24, minStock: 5, unit: "pot", isActive: true },
  ];

  memoryDB.stockMovements = [];
  memoryDB.payments = [];
  memoryDB.transactions = [];
  memoryDB.transactionItems = [];

  if (includeTransactions) {
    memoryDB.customers = [
      { id: "cst_01", name: "Budi", phone: null, instagram: null, branch: "Telkom", totalVisits: 4, totalSpend: 160000, lastVisitAt: new Date(), favoriteBarbermanId: "brb_ari", createdAt: new Date() },
      { id: "cst_02", name: "Rudi Haryanto", phone: "081234567890", instagram: null, branch: "Telkom", totalVisits: 5, totalSpend: 260000, lastVisitAt: subDays(new Date(), 1), favoriteBarbermanId: "brb_dani", createdAt: new Date() },
      { id: "cst_03", name: "Dimas", phone: null, instagram: "@dimas_barber", branch: "Suta", totalVisits: 3, totalSpend: 195000, lastVisitAt: subDays(new Date(), 2), favoriteBarbermanId: "brb_azis", createdAt: new Date() },
    ];

    memoryDB.bookings = [
      { id: "bkg_01", customerId: "cst_01", customerName: "Budi", customerPhone: "081234567890", barbermanId: "brb_ari", serviceId: "srv_haircut_classic", bookingDate: new Date(), bookingTime: "10:00", notes: "Potong rambut", status: "COMPLETED" },
    ];

    const today = new Date();
    
    // Ari transactions (12 items)
    for (let i = 1; i <= 12; i++) {
      const txId = `tx_ari_${i}`;
      const isPomade = i === 3;
      const grandTotal = isPomade ? 40000 + 130000 : 40000;
      memoryDB.transactions.push({
        id: txId,
        invoiceNumber: `AD-${format(today, "yyyyMMdd")}-A${String(i).padStart(3, "0")}`,
        customerId: "cst_01",
        customerName: i === 1 ? "Budi" : `Pelanggan Ari #${i}`,
        customerPhone: i === 1 ? null : `08123456${String(i).padStart(4, "0")}`,
        customerInstagram: null,
        barbermanId: "brb_ari",
        subtotal: grandTotal,
        discount: 0,
        grandTotal,
        paymentMethod: i % 2 === 0 ? "QRIS" : "CASH",
        paymentStatus: "PAID",
        notes: "Transaksi Kasir",
        createdAt: new Date(today.setHours(9 + (i % 8), (i * 15) % 60)),
      });
      
      memoryDB.transactionItems.push({
        id: `txi_ari_${i}_1`,
        transactionId: txId,
        itemType: "SERVICE",
        serviceId: "srv_haircut_classic",
        productId: null,
        name: "Classic Haircut",
        price: 40000,
        quantity: 1,
        subtotal: 40000,
      });

      if (isPomade) {
        memoryDB.transactionItems.push({
          id: `txi_ari_${i}_2`,
          transactionId: txId,
          itemType: "PRODUCT",
          serviceId: null,
          productId: "prd_pomade_01",
          name: "Suavecito Matte Pomade 4oz",
          price: 130000,
          quantity: 1,
          subtotal: 130000,
        });
      }
    }
  }

  memoryDB.initialized = true;
  saveLocalDB();
}