/**
 * Script: seed-transactions.js
 * Memasukkan data transaksi nyata AD Barbershop ke local-db.json
 *
 * Data Cabang Telkom (01-10 Oktober 2026):
 *   1. 01-Oct: AZIS - DEVA, 80K, QR
 *   2. 02-Oct: DANI - HILAL, 80K, QR
 *   3. 03-Oct: ARI - HARIS, 80K, QR
 *   4. 04-Oct: DANI - FADLULLAH, 72K MEMBER (20K DP + 52K), QR
 *   5. 05-Oct: DANI - NADHIM, 80K (20K DP + 60K), QR
 *   6. 06-Oct: ARI - ALEX, 72K MEMBER, QR
 *   7. 07-Oct: AZIS - AVI, 80K, CASH
 *   8. 08-Oct: AZIS - SYAMIL, 80K, QR
 *   9. 09-Oct: AZIS - KANIZA, 80K, QR
 *  10. 10-Oct: DANI - ADMU, 80K, QR
 *
 * Data Cabang Suta (01 Oktober 2026):
 *   1. 01-Oct: ARIF - FAJAR, 80K, QR
 *   2. 01-Oct: ARIF - ERIX, 80K, QR
 *   3. 01-Oct: ARIF - GALIH, 80K, QR
 *   4. 01-Oct: ARIF - MIAN, 80K, QR
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'local-db.json');

// Baca DB
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));

// Helper generate ID
function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

// Helper format tanggal ke ISO string
function toISO(dateStr, hour = 10) {
  // dateStr format: "YYYY-MM-DD"
  return new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00.000+07:00`).toISOString();
}

// Helper invoice number
function makeInvoice(dateStr, seq) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `AD-${y}${m}${day}-${String(seq).padStart(4, '0')}`;
}

// Pastikan array ada
if (!Array.isArray(db.customers)) db.customers = [];
if (!Array.isArray(db.members)) db.members = [];
if (!Array.isArray(db.transactions)) db.transactions = [];
if (!Array.isArray(db.transactionItems)) db.transactionItems = [];
if (!Array.isArray(db.payments)) db.payments = [];
if (!Array.isArray(db.cashTransactions)) db.cashTransactions = [];
if (!Array.isArray(db.activities)) db.activities = [];

// Helper: cari atau buat customer
function findOrCreateCustomer(name, instagram, branch) {
  const existing = db.customers.find(c =>
    c.name.toLowerCase() === name.toLowerCase() && c.branch === branch
  );
  if (existing) return existing;

  const newCustomer = {
    id: `cst_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    name: name.toUpperCase(),
    phone: '',
    email: '',
    instagram: instagram || '',
    branch: branch,
    totalVisits: 0,
    totalSpend: 0,
    isMember: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.customers.push(newCustomer);
  return newCustomer;
}

// Helper: buat atau dapatkan member customer
function ensureMember(customer, discountPercent = 10) {
  if (!customer.isMember) {
    customer.isMember = true;
  }
  // Cek apakah sudah ada member record
  const existingMember = db.members.find(m => m.customerId === customer.id);
  if (!existingMember) {
    db.members.push({
      id: `mbr_${customer.id}`,
      customerId: customer.id,
      branch: customer.branch,
      memberSince: new Date().toISOString(),
      discountPercent: discountPercent,
      isActive: true,
      totalTransactions: 0,
      totalSpend: 0
    });
  }
}

// Helper: buat transaksi
let globalSeq = 1;
function createTransaction({
  date, hour = 10, barmanId, barmanName, customer, branch,
  serviceId, serviceName, amount, paymentMethod, isMember = false,
  dpAmount = 0, notes = ''
}) {
  const txId = genId('tx');
  const itemId = genId('item');
  const payId = genId('pay');
  const cashTxId = genId('cashtx');
  const actId = genId('act');
  const invoiceNumber = makeInvoice(date, globalSeq++);
  const createdAt = toISO(date, hour);

  // Update customer stats
  customer.totalVisits = (customer.totalVisits || 0) + 1;
  customer.totalSpend = (customer.totalSpend || 0) + amount;
  customer.updatedAt = new Date().toISOString();

  // Transaction
  const transaction = {
    id: txId,
    invoiceNumber,
    customerId: customer.id,
    customerName: customer.name,
    barbermanId: barmanId,
    barbermanName: barmanName,
    branch: branch,
    homeBranch: branch, // barber home branch = working branch (semua normal, tidak diperbantukan)
    workingBranch: branch,
    serviceId: serviceId,
    serviceName: serviceName,
    subtotal: amount,
    discount: isMember ? (80000 - amount) : 0,
    grandTotal: amount,
    paymentMethod: paymentMethod, // 'QRIS' | 'CASH'
    paymentStatus: 'PAID',
    status: 'COMPLETED',
    dpAmount: dpAmount,
    isMember: isMember,
    notes: notes,
    instagram: customer.instagram,
    createdAt,
    updatedAt: createdAt
  };

  // Transaction Item
  const item = {
    id: itemId,
    transactionId: txId,
    serviceId: serviceId,
    serviceName: serviceName,
    barbermanId: barmanId,
    barbermanName: barmanName,
    quantity: 1,
    unitPrice: amount,
    subtotal: amount,
    isMember: isMember,
    createdAt
  };

  // Payment
  const payment = {
    id: payId,
    transactionId: txId,
    method: paymentMethod,
    amount: amount,
    dpAmount: dpAmount,
    remainingAmount: amount - dpAmount,
    status: 'PAID',
    createdAt
  };

  // Cash Transaction (pemasukan dari transaksi)
  const cashTransaction = {
    id: cashTxId,
    type: 'CASH_IN',
    category: 'Penjualan Layanan',
    description: `${invoiceNumber} - ${customer.name} - ${serviceName}`,
    amount: amount,
    branch: branch,
    transactionId: txId,
    barbermanId: barmanId,
    paymentMethod: paymentMethod,
    balance: 0, // akan dihitung ulang oleh sistem
    createdAt,
    updatedAt: createdAt
  };

  // Activity
  const activity = {
    id: actId,
    type: 'TRANSACTION',
    description: `Transaksi ${invoiceNumber}: ${customer.name} dilayani oleh ${barmanName} di cabang ${branch}`,
    branch: branch,
    userId: `usr_admin_${branch.toLowerCase()}`,
    referenceId: txId,
    createdAt
  };

  db.transactions.push(transaction);
  db.transactionItems.push(item);
  db.payments.push(payment);
  db.cashTransactions.push(cashTransaction);
  db.activities.push(activity);

  console.log(`  ✅ [${branch}] ${date} | ${barmanName} → ${customer.name} | Rp${amount.toLocaleString('id-ID')} | ${paymentMethod}`);

  return transaction;
}

console.log('\n========================================');
console.log('  SEED TRANSAKSI AD BARBERSHOP');
console.log('========================================\n');

// =====================================
// CABANG TELKOM
// =====================================
console.log('📋 CABANG TELKOM (01-10 Oktober 2026):');

// 1. 01-Oct: AZIS - DEVA, 80K, QR
const deva = findOrCreateCustomer('DEVA', '_varaaaaa_', 'Telkom');
createTransaction({
  date: '2026-10-01', hour: 10,
  barmanId: 'brb_azis', barmanName: 'AZIS',
  customer: deva, branch: 'Telkom',
  serviceId: 'srv_haircut_classic', serviceName: 'Special Service',
  amount: 80000, paymentMethod: 'QRIS'
});

// 2. 02-Oct: DANI - HILAL, 80K, QR
const hilal = findOrCreateCustomer('HILAL', 'ilaludahmakan', 'Telkom');
createTransaction({
  date: '2026-10-02', hour: 10,
  barmanId: 'brb_dani', barmanName: 'DANI',
  customer: hilal, branch: 'Telkom',
  serviceId: 'srv_haircut_classic', serviceName: 'Special Service',
  amount: 80000, paymentMethod: 'QRIS'
});

// 3. 03-Oct: ARI - HARIS, 80K, QR
const haris = findOrCreateCustomer('HARIS', '', 'Telkom');
createTransaction({
  date: '2026-10-03', hour: 10,
  barmanId: 'brb_ari', barmanName: 'ARI',
  customer: haris, branch: 'Telkom',
  serviceId: 'srv_haircut_classic', serviceName: 'Special Service',
  amount: 80000, paymentMethod: 'QRIS'
});

// 4. 04-Oct: DANI - FADLULLAH, 72K MEMBER (DP 20K + 52K), QR
const fadlullah = findOrCreateCustomer('FADLULLAH', 'M.fadhlullah F', 'Telkom');
ensureMember(fadlullah);
createTransaction({
  date: '2026-10-04', hour: 10,
  barmanId: 'brb_dani', barmanName: 'DANI',
  customer: fadlullah, branch: 'Telkom',
  serviceId: 'srv_haircut_classic', serviceName: 'Special Service',
  amount: 72000, paymentMethod: 'QRIS',
  isMember: true, dpAmount: 20000,
  notes: 'Member Price. DP 20K + Pelunasan 52K'
});

// 5. 05-Oct: DANI - NADHIM, 80K (DP 20K + 60K), QR
const nadhim = findOrCreateCustomer('NADHIM', 'mna.dhim_', 'Telkom');
createTransaction({
  date: '2026-10-05', hour: 10,
  barmanId: 'brb_dani', barmanName: 'DANI',
  customer: nadhim, branch: 'Telkom',
  serviceId: 'srv_haircut_classic', serviceName: 'Special Service',
  amount: 80000, paymentMethod: 'QRIS',
  dpAmount: 20000, notes: 'DP 20K + Pelunasan 60K'
});

// 6. 06-Oct: ARI - ALEX, 72K MEMBER, QR
const alex = findOrCreateCustomer('ALEX', 'alex_denhaq', 'Telkom');
ensureMember(alex);
createTransaction({
  date: '2026-10-06', hour: 10,
  barmanId: 'brb_ari', barmanName: 'ARI',
  customer: alex, branch: 'Telkom',
  serviceId: 'srv_haircut_classic', serviceName: 'Special Service',
  amount: 72000, paymentMethod: 'QRIS',
  isMember: true, notes: 'Member Price'
});

// 7. 07-Oct: AZIS - AVI, 80K, CASH
const avi = findOrCreateCustomer('AVI', 'avicenavn', 'Telkom');
createTransaction({
  date: '2026-10-07', hour: 10,
  barmanId: 'brb_azis', barmanName: 'AZIS',
  customer: avi, branch: 'Telkom',
  serviceId: 'srv_haircut_classic', serviceName: 'Special Service',
  amount: 80000, paymentMethod: 'CASH'
});

// 8. 08-Oct: AZIS - SYAMIL, 80K, QR
const syamil = findOrCreateCustomer('SYAMIL', '', 'Telkom');
createTransaction({
  date: '2026-10-08', hour: 10,
  barmanId: 'brb_azis', barmanName: 'AZIS',
  customer: syamil, branch: 'Telkom',
  serviceId: 'srv_haircut_classic', serviceName: 'Special Service',
  amount: 80000, paymentMethod: 'QRIS'
});

// 9. 09-Oct: AZIS - KANIZA, 80K, QR
const kaniza = findOrCreateCustomer('KANIZA', 'kanizaa', 'Telkom');
createTransaction({
  date: '2026-10-09', hour: 10,
  barmanId: 'brb_azis', barmanName: 'AZIS',
  customer: kaniza, branch: 'Telkom',
  serviceId: 'srv_haircut_classic', serviceName: 'Special Service',
  amount: 80000, paymentMethod: 'QRIS'
});

// 10. 10-Oct: DANI - ADMU, 80K, QR
const admu = findOrCreateCustomer('ADMU', '44dmuu_', 'Telkom');
createTransaction({
  date: '2026-10-10', hour: 10,
  barmanId: 'brb_dani', barmanName: 'DANI',
  customer: admu, branch: 'Telkom',
  serviceId: 'srv_haircut_classic', serviceName: 'Special Service',
  amount: 80000, paymentMethod: 'QRIS'
});

// =====================================
// CABANG SUTA
// =====================================
console.log('\n📋 CABANG SUTA (01 Oktober 2026):');

// 1. 01-Oct: ARIF - FAJAR, 80K, QR
const fajar = findOrCreateCustomer('FAJAR', '', 'Suta');
createTransaction({
  date: '2026-10-01', hour: 9,
  barmanId: 'brb_arif', barmanName: 'ARIF',
  customer: fajar, branch: 'Suta',
  serviceId: 'srv_haircut_classic', serviceName: 'Special Service',
  amount: 80000, paymentMethod: 'QRIS'
});

// 2. 01-Oct: ARIF - ERIX, 80K, QR
const erix = findOrCreateCustomer('ERIX', '', 'Suta');
createTransaction({
  date: '2026-10-01', hour: 10,
  barmanId: 'brb_arif', barmanName: 'ARIF',
  customer: erix, branch: 'Suta',
  serviceId: 'srv_haircut_classic', serviceName: 'Special Service',
  amount: 80000, paymentMethod: 'QRIS'
});

// 3. 01-Oct: ARIF - GALIH, 80K, QR
const galih = findOrCreateCustomer('GALIH', '', 'Suta');
createTransaction({
  date: '2026-10-01', hour: 11,
  barmanId: 'brb_arif', barmanName: 'ARIF',
  customer: galih, branch: 'Suta',
  serviceId: 'srv_haircut_classic', serviceName: 'Special Service',
  amount: 80000, paymentMethod: 'QRIS'
});

// 4. 01-Oct: ARIF - MIAN, 80K, QR
const mian = findOrCreateCustomer('MIAN', '', 'Suta');
createTransaction({
  date: '2026-10-01', hour: 12,
  barmanId: 'brb_arif', barmanName: 'ARIF',
  customer: mian, branch: 'Suta',
  serviceId: 'srv_haircut_classic', serviceName: 'Special Service',
  amount: 80000, paymentMethod: 'QRIS'
});

// =====================================
// HITUNG ULANG BALANCE CASH
// =====================================
// Hitung running balance per cabang
let balanceTelkom = db.shopSettings.initialCashFloatTelkom || 0;
let balanceSuta = db.shopSettings.initialCashFloatSuta || 0;

// Sort cash transactions by date
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

// =====================================
// UPDATE MEMBER totalTransactions & totalSpend
// =====================================
db.members.forEach(member => {
  const memberTx = db.transactions.filter(tx => tx.customerId === member.customerId);
  member.totalTransactions = memberTx.length;
  member.totalSpend = memberTx.reduce((sum, tx) => sum + tx.grandTotal, 0);
});

// =====================================
// SIMPAN KE DB
// =====================================
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');

// =====================================
// RINGKASAN
// =====================================
console.log('\n========================================');
console.log('  RINGKASAN HASIL');
console.log('========================================');
console.log(`Total Customers  : ${db.customers.length}`);
console.log(`Total Members    : ${db.members.length}`);
console.log(`Total Transaksi  : ${db.transactions.length}`);
console.log(`Total Tx Items   : ${db.transactionItems.length}`);
console.log(`Total Cash Tx    : ${db.cashTransactions.length}`);
console.log(`Cash Telkom      : Rp${balanceTelkom.toLocaleString('id-ID')}`);
console.log(`Cash Suta        : Rp${balanceSuta.toLocaleString('id-ID')}`);
console.log('');

// Ringkasan per barber
const barbers = ['brb_azis', 'brb_dani', 'brb_ari', 'brb_arif'];
const barberNames = { brb_azis: 'AZIS', brb_dani: 'DANI', brb_ari: 'ARI', brb_arif: 'ARIF' };
barbers.forEach(bid => {
  const txs = db.transactions.filter(t => t.barbermanId === bid);
  const total = txs.reduce((s, t) => s + t.grandTotal, 0);
  console.log(`  ${barberNames[bid]} : ${txs.length} customer | Rp${total.toLocaleString('id-ID')}`);
});

console.log('\n✅ Data berhasil disimpan ke data/local-db.json\n');
