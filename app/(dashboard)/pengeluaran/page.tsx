"use client";

import React, { useState, useEffect } from "react";
import {
  Receipt,
  Plus,
  ArrowUpRight,
  Wallet,
  Building2,
  Calendar,
  CreditCard,
  QrCode,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Filter,
} from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { formatRupiah, formatDateTimeIndo, formatDateIndo } from "@/lib/utils";
import { exportToExcel, exportToCSV } from "@/lib/export";

const CATEGORIES = [
  "Operasional Toko",
  "Pembelian Stok & Bahan",
  "Listrik, Air & Internet",
  "Sewa & Pemeliharaan Gedung",
  "Gaji & Uang Makan Karyawan",
  "Pemasaran & Promosi",
  "Peralatan & Perlengkapan Cukur",
  "Kebersihan & Sanitasi",
  "Pengeluaran Lainnya",
];

const PAYMENT_METHODS = [
  { id: "CASH", label: "CASH (Kas Laci Tunai)", icon: Wallet, desc: "Mengurangi saldo kas fisik laci" },
  { id: "QRIS", label: "QRIS", icon: QrCode, desc: "Rekening digital toko" },
  { id: "TRANSFER", label: "Transfer Bank", icon: CreditCard, desc: "Rekening bank operasional" },
  { id: "DEBIT", label: "Kartu Debit", icon: CreditCard, desc: "EDC Merchant" },
  { id: "E_WALLET", label: "E-Wallet", icon: Wallet, desc: "Saldo dompet digital" },
];

export default function PengeluaranPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    totalExpenses: 0,
    todayExpenses: 0,
    cashExpenses: 0,
    nonCashExpenses: 0,
    telkomExpenses: 0,
    sutaExpenses: 0,
    count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  // Filters
  const [filterBranch, setFilterBranch] = useState<string>("All");
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [filterMethod, setFilterMethod] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Notification banners
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState<number | string>("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [branch, setBranch] = useState<"Telkom" | "Suta">("Telkom");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const isOwner = session?.role === "OWNER";
  const userBranch = session?.role === "ADMIN_SUTA" ? "Suta" : "Telkom";

  // Fetch session
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated && d.user) {
          setSession(d.user);
          if (d.user.role === "ADMIN_SUTA") {
            setFilterBranch("Suta");
            setBranch("Suta");
          } else if (d.user.role === "ADMIN_TELKOM") {
            setFilterBranch("Telkom");
            setBranch("Telkom");
          }
        }
      })
      .catch(() => {});
  }, []);

  // Fetch expenses
  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterBranch && filterBranch !== "All") params.set("branch", filterBranch);
      if (filterCategory && filterCategory !== "All") params.set("category", filterCategory);
      if (filterMethod && filterMethod !== "All") params.set("paymentMethod", filterMethod);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/expenses?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat data pengeluaran");

      setExpenses(json.expenses || []);
      setSummary(json.summary || {
        totalExpenses: 0,
        todayExpenses: 0,
        cashExpenses: 0,
        nonCashExpenses: 0,
        telkomExpenses: 0,
        sutaExpenses: 0,
        count: 0,
      });
    } catch (err: any) {
      console.error(err);
      setBannerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [filterBranch, filterCategory, filterMethod, startDate, endDate]);

  const handleOpenModal = () => {
    setCategory(CATEGORIES[0]);
    setAmount("");
    setDescription("");
    setExpenseDate(new Date().toISOString().split("T")[0]);
    setPaymentMethod("CASH");
    if (!isOwner) {
      setBranch(userBranch);
    }
    setModalError(null);
    setModalOpen(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setModalError("Nominal pengeluaran harus lebih besar dari Rp 0");
      return;
    }
    if (!description.trim()) {
      setModalError("Keterangan pengeluaran wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        category,
        amount: numAmount,
        description: description.trim(),
        expenseDate,
        paymentMethod,
        branch: isOwner ? branch : userBranch,
      };

      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal menyimpan pengeluaran ke server");
      }

      // Success feedback
      setModalOpen(false);
      setBannerSuccess(`Berhasil menyimpan pengeluaran ${formatRupiah(numAmount)} (${category}) ke Supabase!`);
      setTimeout(() => setBannerSuccess(null), 5000);

      // Auto-refresh list and totals
      await fetchExpenses();
    } catch (err: any) {
      setModalError(err.message || "Terjadi kesalahan saat menyimpan pengeluaran");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string, desc: string, amt: number) => {
    if (!confirm(`Hapus catatan pengeluaran "${desc}" senilai ${formatRupiah(amt)}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/expenses?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menghapus pengeluaran");

      setBannerSuccess("Data pengeluaran berhasil dihapus!");
      setTimeout(() => setBannerSuccess(null), 4000);
      fetchExpenses();
    } catch (err: any) {
      alert(err.message || "Gagal menghapus");
    }
  };

  const handleExport = (type: "excel" | "csv") => {
    const formatted = filteredExpenses.map((exp: any) => ({
      "Tanggal": formatDateIndo(exp.expenseDate || exp.createdAt),
      "Cabang": exp.branch || "Telkom",
      "Kategori": exp.category,
      "Keterangan": exp.description,
      "Metode Pembayaran": exp.paymentMethod || "CASH",
      "Nominal": exp.amount,
    }));
    const filename = `Pengeluaran_AD_Barbershop_${filterBranch}`;
    if (type === "excel") exportToExcel(formatted, filename);
    else exportToCSV(formatted, filename);
  };

  // Client-side search filter
  const filteredExpenses = expenses.filter((e) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (e.description && e.description.toLowerCase().includes(q)) ||
      (e.category && e.category.toLowerCase().includes(q)) ||
      (e.branch && e.branch.toLowerCase().includes(q)) ||
      (e.paymentMethod && e.paymentMethod.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* SUCCESS / ERROR TOP NOTIFICATION */}
      {bannerSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="text-xs font-bold">{bannerSuccess}</span>
          </div>
          <button onClick={() => setBannerSuccess(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {bannerError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span className="text-xs font-bold">{bannerError}</span>
          </div>
          <button onClick={() => setBannerError(null)} className="text-rose-700 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* HEADER & ACTION BUTTONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-wide flex items-center gap-2">
            <Receipt className="w-6 h-6 text-rose-600" />
            <span>PENGELUARAN (EXPENSES)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pencatatan beban operasional, belanja persediaan, utilitas, dan rincian kas keluar cabang AD Barbershop.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => handleExport("excel")} variant="secondary" size="sm">
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            Excel
          </Button>
          <Button onClick={fetchExpenses} variant="secondary" size="sm" disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Segarkan
          </Button>
          <Button
            onClick={handleOpenModal}
            variant="primary"
            size="sm"
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md shadow-rose-500/20"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            + Catat Pengeluaran
          </Button>
        </div>
      </div>

      {/* RINGKASAN METRIK KARTU EXPENSES */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Card 1: Total Pengeluaran */}
        <Card className="p-4 border-rose-200 bg-rose-50/50">
          <div className="text-[11px] text-rose-800 font-bold flex items-center justify-between">
            <span>Total Pengeluaran</span>
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700 mt-1">
            {formatRupiah(summary.totalExpenses || 0)}
          </div>
          <div className="text-[10px] text-rose-600 font-medium mt-0.5">
            {summary.count || 0} transaksi tercatat
          </div>
        </Card>

        {/* Card 2: Pengeluaran Hari Ini */}
        <Card className="p-4 border-amber-200 bg-amber-50/50">
          <div className="text-[11px] text-amber-800 font-bold flex items-center justify-between">
            <span>Hari Ini</span>
            <Calendar className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700 mt-1">
            {formatRupiah(summary.todayExpenses || 0)}
          </div>
          <div className="text-[10px] text-amber-600 font-medium mt-0.5">
            Beban operasional hari ini
          </div>
        </Card>

        {/* Card 3: Beban Tunai (Kas Laci) */}
        <Card className="p-4 border-emerald-200 bg-emerald-50/50">
          <div className="text-[11px] text-emerald-800 font-bold flex items-center justify-between">
            <span>Tunai (Kas Laci)</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            {formatRupiah(summary.cashExpenses || 0)}
          </div>
          <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
            Memotong saldo kas laci
          </div>
        </Card>

        {/* Card 4: Beban Non-Tunai */}
        <Card className="p-4 border-purple-200 bg-purple-50/50">
          <div className="text-[11px] text-purple-800 font-bold flex items-center justify-between">
            <span>Non-Tunai (Transfer/QR)</span>
            <CreditCard className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-700 mt-1">
            {formatRupiah(summary.nonCashExpenses || 0)}
          </div>
          <div className="text-[10px] text-purple-600 font-medium mt-0.5">
            Via rekening / e-wallet
          </div>
        </Card>
      </div>

      {/* OWNER: BREAKDOWN CABANG TELKOM & SUTA */}
      {isOwner && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Card className="p-3.5 border-sky-200 bg-sky-50/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-800 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-sky-600" /> Cabang Telkom
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-bold">Telkom</span>
            </div>
            <div className="text-xl font-black text-sky-900 mt-1">
              {formatRupiah(summary.telkomExpenses || 0)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Pengeluaran terakumulasi Cabang Telkom</div>
          </Card>

          <Card className="p-3.5 border-indigo-200 bg-indigo-50/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-800 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" /> Cabang Suta
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold">Suta</span>
            </div>
            <div className="text-xl font-black text-indigo-900 mt-1">
              {formatRupiah(summary.sutaExpenses || 0)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Pengeluaran terakumulasi Cabang Suta</div>
          </Card>
        </div>
      )}

      {/* FILTER & PENCARIAN BAR */}
      <Card className="p-4 border-slate-200 bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
          {/* SEARCH */}
          <div className="relative col-span-1 sm:col-span-2">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Cari keterangan, kategori..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600"
            />
          </div>

          {/* CABANG FILTER (HANYA OWNER YANG BISA FILTER; ADMIN TERKUNCI) */}
          <div>
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              disabled={!isOwner}
              className={`w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 font-semibold focus:outline-none ${
                !isOwner ? "bg-slate-100 cursor-not-allowed text-slate-500" : "bg-slate-50 focus:bg-white focus:border-blue-600"
              }`}
            >
              {isOwner ? (
                <>
                  <option value="All">Semua Cabang</option>
                  <option value="Telkom">Cabang Telkom</option>
                  <option value="Suta">Cabang Suta</option>
                </>
              ) : (
                <option value={userBranch}>Cabang {userBranch}</option>
              )}
            </select>
          </div>

          {/* KATEGORI FILTER */}
          <div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:bg-white focus:border-blue-600"
            >
              <option value="All">Semua Kategori</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* METODE BAYAR FILTER */}
          <div>
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:bg-white focus:border-blue-600"
            >
              <option value="All">Semua Metode</option>
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.label}
                </option>
              ))}
            </select>
          </div>

          {/* RESET FILTER BUTTON */}
          <div className="flex items-center">
            <button
              onClick={() => {
                setSearchQuery("");
                setFilterCategory("All");
                setFilterMethod("All");
                setStartDate("");
                setEndDate("");
                if (isOwner) setFilterBranch("All");
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition flex items-center justify-center gap-1.5"
            >
              <Filter className="w-3 h-3" />
              Reset Filter
            </button>
          </div>
        </div>
      </Card>

      {/* TABEL DAFTAR PENGELUARAN */}
      <Card className="border-slate-200 overflow-hidden shadow-sm bg-white">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-rose-600" />
            <span>Daftar Transaksi Pengeluaran ({filteredExpenses.length})</span>
          </CardTitle>
          <span className="text-xs text-slate-500 font-medium">
            Terhubung langsung ke Supabase PostgreSQL
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase font-bold text-[11px]">
                <th className="py-3 px-4">Tanggal & Waktu</th>
                <th className="py-3 px-4">Cabang</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">Keterangan / Rincian</th>
                <th className="py-3 px-4">Metode Bayar</th>
                <th className="py-3 px-4 text-right">Nominal (Rp)</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-600" />
                    Memuat data pengeluaran dari Supabase...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    Belum ada data pengeluaran yang tercatat.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp: any) => {
                  const isCash = exp.paymentMethod === "CASH";
                  return (
                    <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {formatDateTimeIndo(exp.expenseDate || exp.createdAt)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            exp.branch === "Suta"
                              ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                              : "bg-sky-100 text-sky-700 border border-sky-200"
                          }`}
                        >
                          {exp.branch || "Telkom"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {exp.category}
                      </td>
                      <td className="py-3 px-4 text-slate-700 max-w-xs truncate" title={exp.description}>
                        {exp.description}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isCash
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : exp.paymentMethod === "QRIS"
                              ? "bg-purple-100 text-purple-800 border border-purple-200"
                              : "bg-blue-100 text-blue-800 border border-blue-200"
                          }`}
                        >
                          {isCash ? <Wallet className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                          {exp.paymentMethod || "CASH"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-rose-600 whitespace-nowrap">
                        -{formatRupiah(exp.amount)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteExpense(exp.id, exp.description, exp.amount)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Hapus Pengeluaran"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredExpenses.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200 font-black text-slate-900">
                  <td colSpan={5} className="py-3 px-4 uppercase text-slate-800 text-right">
                    Total Pengeluaran (Tampil):
                  </td>
                  <td className="py-3 px-4 text-right text-rose-700 text-sm">
                    -{formatRupiah(filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0))}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* MODAL INPUT PENGELUARAN */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Catat Pengeluaran Baru"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveExpense} className="space-y-4">
          {modalError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          {/* CABANG (PILIHAN KHUSUS OWNER, ADMIN OTOMATIS) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Cabang Pengeluaran <span className="text-rose-500 font-bold">*</span>
            </label>
            {isOwner ? (
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600"
              >
                <option value="Telkom">Cabang Telkom</option>
                <option value="Suta">Cabang Suta</option>
              </select>
            ) : (
              <div className="px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Cabang {userBranch}</span>
                <span className="text-[10px] text-slate-400 font-medium">Sesuai Hak Akses Admin</span>
              </div>
            )}
          </div>

          {/* KATEGORI */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Kategori Pengeluaran <span className="text-rose-500 font-bold">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* NOMINAL INPUT */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nominal Pengeluaran (Rp) <span className="text-rose-500 font-bold">*</span>
            </label>
            <input
              type="number"
              required
              min="1000"
              step="1000"
              placeholder="Contoh: 50000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 font-black focus:outline-none focus:bg-white focus:border-blue-600"
            />
            {Number(amount) > 0 && (
              <p className="text-[11px] font-bold text-rose-600 mt-1">
                Terbaca: {formatRupiah(Number(amount))}
              </p>
            )}
          </div>

          {/* TANGGAL */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tanggal Pengeluaran <span className="text-rose-500 font-bold">*</span>
            </label>
            <input
              type="date"
              required
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600"
            />
          </div>

          {/* METODE PEMBAYARAN */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Metode Pembayaran <span className="text-rose-500 font-bold">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((pm) => {
                const Icon = pm.icon;
                const isSelected = paymentMethod === pm.id;
                return (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setPaymentMethod(pm.id)}
                    className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition ${
                      isSelected
                        ? "border-rose-500 bg-rose-50/80 text-rose-900 shadow-sm"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isSelected ? "text-rose-600" : "text-slate-400"}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{pm.label}</div>
                      <div className="text-[9px] text-slate-400 truncate">{pm.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {paymentMethod === "CASH" && (
              <p className="text-[10px] text-emerald-700 mt-1.5 font-medium bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                💡 Pembayaran CASH otomatis memotong saldo fisik laci pada Cash Management.
              </p>
            )}
          </div>

          {/* KETERANGAN */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Keterangan / Rincian Belanja <span className="text-rose-500 font-bold">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Beli air galon aqua, tisu leher, dan cairan pembersih lantai"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600"
            />
          </div>

          {/* TOMBOL SIMPAN */}
          <div className="pt-2 border-t border-slate-100 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
              className="flex-1 font-semibold"
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              variant="danger"
              className="flex-1 font-bold shadow-md shadow-rose-500/20"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Menyimpan ke Supabase...
                </>
              ) : (
                "Simpan Pengeluaran"
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

