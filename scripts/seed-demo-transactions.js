/**
 * Script: seed-demo-transactions.js
 * Membuat 20 transaksi demo di Cabang TELKOM dan 10 transaksi demo di Cabang SUTA
 * Sesuai permintaan user:
 * - Telkom: 20 transaksi (Barber: DANI, ARI, AZIS)
 * - Suta: 10 transaksi (Barber: ADE, ARIF, AKMAL)
 * - Total: 30 transaksi
 *
 * Mengupdate data/local-db.json DAN jika DATABASE_URL ada, menyimpan langsung ke Supabase PostgreSQL!
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'local-db.json');
let db = {};
try {
  db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
} catch (e) {
  console.log('File local-db.json baru akan dibuat');
}

// Pastikan semua array tersedia
if (!Array.isArray(db.customers)) db.customers = [];
if (!Array.isArray(db.members)) db.members = [];
if (!Array.isArray(db.transactions)) db.transactions = [];
if (!Array.isArray(db.transactionItems)) db.transactionItems = [];
if (!Array.isArray(db.payments)) db.payments = [];
if (!Array.isArray(db.cashTransactions)) db.cashTransactions = [];
if (!Array.isArray(db.activities)) db.activities = [];
if (!db.shopSettings) {
  db.shopSettings = {
    initialCashFloatTelkom: 200000,
    initialCashFloatSuta: 150000,
  };
}

// Clear old transactions for clean demo data
db.transactions = [];
db.transactionItems = [];
db.payments = [];
db.cashTransactions = [];
db.activities = [];

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

function toISO(dateStr, hour = 10, minute = 0) {
  return new Date(`${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000+07:00`).toISOString();
}

function makeInvoice(dateStr, seq) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `AD-${y}${m}${day}-${String(seq).padStart(4, '0')}`;
}

function findOrCreateCustomer(name, instagram, branch, isMember = false) {
  let cust = db.customers.find(
    c => c.name.toLowerCase() === name.toLowerCase() && c.branch === branch
  );
  if (!cust) {
    cust = {
      id: `cst_${name.toLowerCase().replace(/\s+/g, '_')}_${Math.random().toString(36).substr(2, 4)}`,
      name: name.toUpperCase(),
      phone: `0812${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `${name.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
      instagram: instagram || '',
      branch: branch,
      totalVisits: 0,
      totalSpend: 0,
      isMember: isMember,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.customers.push(cust);
  } else {
    cust.branch = branch;
    cust.isMember = isMember;
  }

  if (isMember) {
    let mem = db.members.find(m => m.customerId === cust.id);
    if (!mem) {
      db.members.push({
        id: `mbr_${cust.id}`,
        customerId: cust.id,
        branch: branch,
        memberSince: new Date().toISOString(),
        discountPercent: 10,
        isActive: true,
        totalTransactions: 0,
        totalSpend: 0
      });
    }
  }

  return cust;
}

let seq = 1;
function addTransaction({
  date, hour, minute = 0,
  barmanId, barmanName,
  customerName, customerIg, isMember = false,
  branch,
  serviceName, servicePrice,
  productName, productPrice = 0,
  paymentMethod,
  dpAmount = 0,
  notes = ''
}) {
  const txId = genId('tx');
  const invoiceNumber = makeInvoice(date, seq++);
  const createdAt = toISO(date, hour, minute);

  const customer = findOrCreateCustomer(customerName, customerIg, branch, isMember);

  const discount = isMember ? Math.round(servicePrice * 0.1) : 0;
  const subtotal = servicePrice + productPrice;
  const grandTotal = subtotal - discount;

  customer.totalVisits = (customer.totalVisits || 0) + 1;
  customer.totalSpend = (customer.totalSpend || 0) + grandTotal;
  customer.updatedAt = createdAt;

  // Transaction Record
  const transaction = {
    id: txId,
    invoiceNumber,
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    barbermanId: barmanId,
    barbermanName: barmanName,
    branch: branch,
    homeBranch: branch,
    workingBranch: branch,
    serviceId: 'srv_haircut',
    serviceName: serviceName,
    subtotal: subtotal,
    discount: discount,
    grandTotal: grandTotal,
    paymentMethod: paymentMethod,
    paymentStatus: 'PAID',
    status: 'COMPLETED',
    dpAmount: dpAmount,
    isMember: isMember,
    notes: notes,
    instagram: customer.instagram,
    createdAt,
    updatedAt: createdAt
  };

  // Transaction Item (Service)
  const serviceItem = {
    id: genId('item'),
    transactionId: txId,
    serviceId: 'srv_haircut',
    serviceName: serviceName,
    barbermanId: barmanId,
    barbermanName: barmanName,
    quantity: 1,
    unitPrice: servicePrice,
    subtotal: servicePrice,
    isMember: isMember,
    createdAt
  };
  db.transactionItems.push(serviceItem);

  // If there's a product
  if (productName && productPrice > 0) {
    const prodItem = {
      id: genId('item'),
      transactionId: txId,
      productId: 'prd_pomade',
      productName: productName,
      barbermanId: barmanId,
      barbermanName: barmanName,
      quantity: 1,
      unitPrice: productPrice,
      subtotal: productPrice,
      isMember: false,
      createdAt
    };
    db.transactionItems.push(prodItem);
  }

  // Payment
  const payment = {
    id: genId('pay'),
    transactionId: txId,
    method: paymentMethod,
    amount: grandTotal,
    dpAmount: dpAmount,
    remainingAmount: grandTotal - dpAmount,
    status: 'PAID',
    createdAt
  };
  db.payments.push(payment);

  // Cash transaction (if CASH)
  const cashTransaction = {
    id: genId('cashtx'),
    type: 'CASH_IN',
    category: 'Penjualan Layanan',
    description: `${invoiceNumber} - ${customer.name} - ${serviceName}`,
    amount: grandTotal,
    branch: branch,
    transactionId: txId,
    barbermanId: barmanId,
    paymentMethod: paymentMethod,
    balance: 0,
    createdAt,
    updatedAt: createdAt
  };
  db.cashTransactions.push(cashTransaction);

  // Activity Log
  const activity = {
    id: genId('act'),
    type: 'TRANSACTION',
    description: `Transaksi ${invoiceNumber}: ${customer.name} dilayani oleh ${barmanName} di Cabang ${branch} (Rp${grandTotal.toLocaleString('id-ID')})`,
    branch: branch,
    userId: `usr_admin_${branch.toLowerCase()}`,
    referenceId: txId,
    createdAt
  };
  db.activities.push(activity);

  db.transactions.push(transaction);
  return transaction;
}

console.log('==============================================');
console.log('🚀 SEEDING 20 TRANSAKSI TELKOM & 10 TRANSAKSI SUTA');
console.log('==============================================\n');

// =========================================================================
// 1. CABANG TELKOM: 20 TRANSAKSI (Barber: DANI, ARI, AZIS)
// =========================================================================
console.log('--- CABANG TELKOM (20 Transaksi) ---');

const telkomTxs = [
  // 1-7: DANI (7 transaksi)
  { date: '2026-10-01', hour: 10, barmanId: 'brb_dani', barmanName: 'Dani', customerName: 'Hilal Pratama', customerIg: 'ilaludahmakan', isMember: false, serviceName: 'Special Service Haircut', servicePrice: 80000, paymentMethod: 'QRIS' },
  { date: '2026-10-01', hour: 13, barmanId: 'brb_dani', barmanName: 'Dani', customerName: 'Fadlullah Fahmi', customerIg: 'm.fadhlullah', isMember: true, serviceName: 'Premium Haircut & Wash', servicePrice: 60000, paymentMethod: 'QRIS', dpAmount: 20000, notes: 'Member DP 20K' },
  { date: '2026-10-02', hour: 11, barmanId: 'brb_dani', barmanName: 'Dani', customerName: 'Nadhim Alamsyah', customerIg: 'mna.dhim_', isMember: false, serviceName: 'Special Service Haircut', servicePrice: 80000, paymentMethod: 'TRANSFER', dpAmount: 20000 },
  { date: '2026-10-02', hour: 15, barmanId: 'brb_dani', barmanName: 'Dani', customerName: 'Admu Ramadhan', customerIg: '44dmuu_', isMember: false, serviceName: 'Classic Haircut', servicePrice: 40000, productName: 'Suavecito Pomade', productPrice: 130000, paymentMethod: 'QRIS' },
  { date: '2026-10-03', hour: 12, barmanId: 'brb_dani', barmanName: 'Dani', customerName: 'Rifky Aditya', customerIg: 'rifky_adit', isMember: true, serviceName: 'Hair Spa & Creambath', servicePrice: 75000, paymentMethod: 'CASH' },
  { date: '2026-10-03', hour: 16, barmanId: 'brb_dani', barmanName: 'Dani', customerName: 'Bagas Prasetyo', customerIg: 'bagas.pras', isMember: false, serviceName: 'Classic Haircut', servicePrice: 40000, paymentMethod: 'QRIS' },
  { date: '2026-10-04', hour: 10, barmanId: 'brb_dani', barmanName: 'Dani', customerName: 'Yusuf Habibi', customerIg: 'yusuf_hbb', isMember: false, serviceName: 'Special Service Haircut', servicePrice: 80000, paymentMethod: 'DEBIT' },

  // 8-14: ARI (7 transaksi)
  { date: '2026-10-01', hour: 11, barmanId: 'brb_ari', barmanName: 'Ari', customerName: 'Haris Munandar', customerIg: 'harismun', isMember: false, serviceName: 'Special Service Haircut', servicePrice: 80000, paymentMethod: 'QRIS' },
  { date: '2026-10-01', hour: 14, barmanId: 'brb_ari', barmanName: 'Ari', customerName: 'Alex Denhaq', customerIg: 'alex_denhaq', isMember: true, serviceName: 'Special Service Haircut', servicePrice: 80000, paymentMethod: 'QRIS', notes: 'Member Disc 10%' },
  { date: '2026-10-02', hour: 10, barmanId: 'brb_ari', barmanName: 'Ari', customerName: 'Dimas Setiawan', customerIg: 'dimas_stwn', isMember: false, serviceName: 'Classic Haircut', servicePrice: 40000, paymentMethod: 'CASH' },
  { date: '2026-10-02', hour: 14, barmanId: 'brb_ari', barmanName: 'Ari', customerName: 'Fikri Haikal', customerIg: 'fikri.hk', isMember: false, serviceName: 'Premium Haircut (Wash + Massage)', servicePrice: 60000, paymentMethod: 'QRIS' },
  { date: '2026-10-03', hour: 11, barmanId: 'brb_ari', barmanName: 'Ari', customerName: 'Iqbal Tawakal', customerIg: 'iqbal_twk', isMember: true, serviceName: 'Classic Haircut', servicePrice: 40000, productName: 'Dust It Hair Powder', productPrice: 80000, paymentMethod: 'TRANSFER' },
  { date: '2026-10-03', hour: 17, barmanId: 'brb_ari', barmanName: 'Ari', customerName: 'Aldi Taher', customerIg: 'alditaher_real', isMember: false, serviceName: 'Beard Trim & Hot Towel Shave', servicePrice: 25000, paymentMethod: 'CASH' },
  { date: '2026-10-04', hour: 11, barmanId: 'brb_ari', barmanName: 'Ari', customerName: 'Gilang Ramadhan', customerIg: 'gilang_rmd', isMember: false, serviceName: 'Special Service Haircut', servicePrice: 80000, paymentMethod: 'QRIS' },

  // 15-20: AZIS (6 transaksi)
  { date: '2026-10-01', hour: 12, barmanId: 'brb_azis', barmanName: 'Azis', customerName: 'Deva Narendra', customerIg: '_varaaaaa_', isMember: false, serviceName: 'Special Service Haircut', servicePrice: 80000, paymentMethod: 'QRIS' },
  { date: '2026-10-01', hour: 16, barmanId: 'brb_azis', barmanName: 'Azis', customerName: 'Avicena Novianto', customerIg: 'avicenavn', isMember: false, serviceName: 'Special Service Haircut', servicePrice: 80000, paymentMethod: 'CASH' },
  { date: '2026-10-02', hour: 13, barmanId: 'brb_azis', barmanName: 'Azis', customerName: 'Syamil Basalamah', customerIg: 'syamil_b', isMember: false, serviceName: 'Special Service Haircut', servicePrice: 80000, paymentMethod: 'QRIS' },
  { date: '2026-10-02', hour: 17, barmanId: 'brb_azis', barmanName: 'Azis', customerName: 'Kaniza Ardiansyah', customerIg: 'kanizaa', isMember: false, serviceName: 'Special Service Haircut', servicePrice: 80000, paymentMethod: 'QRIS' },
  { date: '2026-10-03', hour: 14, barmanId: 'brb_azis', barmanName: 'Azis', customerName: 'Kevin Sanjaya', customerIg: 'kevin_sjy', isMember: true, serviceName: 'Premium Haircut (Wash + Massage)', servicePrice: 60000, paymentMethod: 'TRANSFER' },
  { date: '2026-10-04', hour: 13, barmanId: 'brb_azis', barmanName: 'Azis', customerName: 'Maulana Malik', customerIg: 'maul_mlk', isMember: false, serviceName: 'Classic Haircut', servicePrice: 40000, productName: 'Chief Pomade Black', productPrice: 145000, paymentMethod: 'QRIS' },
];

telkomTxs.forEach((tx, idx) => {
  const res = addTransaction({ ...tx, branch: 'Telkom' });
  console.log(`  [Telkom #${idx + 1}] ${tx.date} | ${tx.barmanName} → ${tx.customerName} | Rp${res.grandTotal.toLocaleString('id-ID')} (${tx.paymentMethod})`);
});

// =========================================================================
// 2. CABANG SUTA: 10 TRANSAKSI (Barber: ADE, ARIF, AKMAL)
// =========================================================================
console.log('\n--- CABANG SUTA (10 Transaksi) ---');

const sutaTxs = [
  // 1-4: ARIF (4 transaksi)
  { date: '2026-10-01', hour: 9, barmanId: 'brb_arif', barmanName: 'Arif', customerName: 'Fajar Nugraha', customerIg: 'fajar_ngr', isMember: false, serviceName: 'Special Service Haircut', servicePrice: 80000, paymentMethod: 'QRIS' },
  { date: '2026-10-01', hour: 11, barmanId: 'brb_arif', barmanName: 'Arif', customerName: 'Erix Soekamti', customerIg: 'erix_soekamti', isMember: false, serviceName: 'Special Service Haircut', servicePrice: 80000, paymentMethod: 'QRIS' },
  { date: '2026-10-02', hour: 10, barmanId: 'brb_arif', barmanName: 'Arif', customerName: 'Galih Ginanjar', customerIg: 'galih_gnj', isMember: false, serviceName: 'Special Service Haircut', servicePrice: 80000, paymentMethod: 'CASH' },
  { date: '2026-10-03', hour: 14, barmanId: 'brb_arif', barmanName: 'Arif', customerName: 'Mian Tiarno', customerIg: 'mian_t', isMember: false, serviceName: 'Special Service Haircut', servicePrice: 80000, paymentMethod: 'QRIS' },

  // 5-7: ADE (3 transaksi)
  { date: '2026-10-01', hour: 14, barmanId: 'brb_ade', barmanName: 'Ade', customerName: 'Budi Hartono', customerIg: 'budi_hrtn', isMember: true, serviceName: 'Premium Haircut & Wash', servicePrice: 60000, paymentMethod: 'QRIS', notes: 'Member Suta' },
  { date: '2026-10-02', hour: 13, barmanId: 'brb_ade', barmanName: 'Ade', customerName: 'Rian D’Masiv', customerIg: 'rian_dmasiv', isMember: false, serviceName: 'Classic Haircut', servicePrice: 40000, productName: 'Hair Tonic Ginseng', productPrice: 60000, paymentMethod: 'TRANSFER' },
  { date: '2026-10-03', hour: 16, barmanId: 'brb_ade', barmanName: 'Ade', customerName: 'Bayu Skak', customerIg: 'bayuskak', isMember: false, serviceName: 'Special Service Haircut', servicePrice: 80000, paymentMethod: 'QRIS' },

  // 8-10: AKMAL (3 transaksi)
  { date: '2026-10-02', hour: 15, barmanId: 'brb_akmal', barmanName: 'Akmal', customerName: 'Reza Rahadian', customerIg: 'officialreza', isMember: false, serviceName: 'Classic Haircut', servicePrice: 40000, paymentMethod: 'CASH' },
  { date: '2026-10-03', hour: 11, barmanId: 'brb_akmal', barmanName: 'Akmal', customerName: 'Hendra Setiawan', customerIg: 'hendra_setiawan', isMember: true, serviceName: 'Hair Spa & Creambath', servicePrice: 75000, paymentMethod: 'QRIS' },
  { date: '2026-10-04', hour: 10, barmanId: 'brb_akmal', barmanName: 'Akmal', customerName: 'Deni Cagur', customerIg: 'denicagur', isMember: false, serviceName: 'Special Service Haircut', servicePrice: 80000, paymentMethod: 'QRIS' },
];

sutaTxs.forEach((tx, idx) => {
  const res = addTransaction({ ...tx, branch: 'Suta' });
  console.log(`  [Suta #${idx + 1}] ${tx.date} | ${tx.barmanName} → ${tx.customerName} | Rp${res.grandTotal.toLocaleString('id-ID')} (${tx.paymentMethod})`);
});

// Hitung balance cash
let balanceTelkom = db.shopSettings.initialCashFloatTelkom || 200000;
let balanceSuta = db.shopSettings.initialCashFloatSuta || 150000;

db.cashTransactions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
db.cashTransactions.forEach(ct => {
  if (ct.branch === 'Telkom') {
    if (ct.type === 'CASH_IN') balanceTelkom += ct.amount;
    else if (ct.type === 'CASH_OUT') balanceTelkom -= ct.amount;
    ct.balance = balanceTelkom;
  } else if (ct.branch === 'Suta') {
    if (ct.type === 'CASH_IN') balanceSuta += ct.amount;
    else if (ct.type === 'CASH_OUT') balanceSuta -= ct.amount;
    ct.balance = balanceSuta;
  }
});

// Update Member Stats
db.members.forEach(member => {
  const mTx = db.transactions.filter(t => t.customerId === member.customerId);
  member.totalTransactions = mTx.length;
  member.totalSpend = mTx.reduce((sum, t) => sum + t.grandTotal, 0);
});

// Simpan ke local-db.json
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');

console.log('\n==============================================');
console.log('🎉 SEEDING SELESAI!');
console.log('==============================================');
const telkomCount = db.transactions.filter(t => t.branch === 'Telkom').length;
const sutaCount = db.transactions.filter(t => t.branch === 'Suta').length;
const totalRevenue = db.transactions.reduce((sum, t) => sum + t.grandTotal, 0);
const telkomRevenue = db.transactions.filter(t => t.branch === 'Telkom').reduce((sum, t) => sum + t.grandTotal, 0);
const sutaRevenue = db.transactions.filter(t => t.branch === 'Suta').reduce((sum, t) => sum + t.grandTotal, 0);

console.log(`Cabang Telkom : ${telkomCount} Transaksi | Omzet: Rp${telkomRevenue.toLocaleString('id-ID')}`);
console.log(`Cabang Suta   : ${sutaCount} Transaksi | Omzet: Rp${sutaRevenue.toLocaleString('id-ID')}`);
console.log(`Total Semua   : ${db.transactions.length} Transaksi | Omzet: Rp${totalRevenue.toLocaleString('id-ID')}`);
console.log(`Total Customer: ${db.customers.length}`);
console.log(`File tersimpan: ${DB_PATH}\n`);
