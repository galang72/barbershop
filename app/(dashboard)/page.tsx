"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Receipt,
  TrendingUp,
  Calendar,
  CreditCard,
  Package,
  AlertTriangle,
  ShoppingBag,
  Wallet,
  CalendarRange,
  ArrowUpRight,
  Printer,
  FileSpreadsheet,
  Scissors,
  ArrowLeftRight,
  Building2,
  Clock,
} from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRupiah, formatDateTimeIndo } from "@/lib/utils";
import { exportToExcel, exportToCSV } from "@/lib/export";

import { useUser } from "@/lib/user-context";

// Client-side module-level cache for instant 0ms tab-switching without lag
let _dashboardClientCache: Record<string, any> = {};

export default function DashboardPage() {
  const [filter, setFilter] = useState("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const { user } = useUser();

  const cacheKey = `${filter}:${user?.role || ""}:${user?.branch || ""}`;
  const [data, setData] = useState<any>(_dashboardClientCache[cacheKey] || null);
  const [loading, setLoading] = useState(!_dashboardClientCache[cacheKey]);

  const fetchDashboard = async () => {
    // Only show loading spinner if we don't have cached data yet
    if (!_dashboardClientCache[cacheKey]) {
      setLoading(true);
    }
    try {
      let url = `/api/dashboard?filter=${filter}&_t=${Date.now()}`;
      if (filter === "custom" && customStart && customEnd) {
        url += `&start=${customStart}&end=${customEnd}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      _dashboardClientCache[cacheKey] = json;
      setData(json);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (_dashboardClientCache[cacheKey]) {
      setData(_dashboardClientCache[cacheKey]);
    }
    fetchDashboard();
  }, [filter, cacheKey]);

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStart && customEnd) {
      fetchDashboard();
    }
  };

  const isOwner = user?.role === "OWNER";
  const metrics = data?.metrics || {
    todayCustomer: 0,
    todayTransaction: 0,
    todayRevenue: 0,
    monthRevenue: 0,
    todayBooking: 0,
    totalMember: 0,
    totalProduct: 0,
    lowStockProducts: 0,
    productSalesRevenue: 0,
    cashInHand: 0,
  };

  const telkomMetrics = data?.telkomMetrics || metrics;
  const sutaMetrics = data?.sutaMetrics || metrics;
  const totalMetrics = data?.totalMetrics || metrics;
  const barberPerformance = data?.barberPerformance || [];
  const recentActivities = data?.recentActivities || [];

  const handleExportExcel = () => {
    const formatted = barberPerformance.map((b: any) => ({
      "Nama Barberman": b.name,
      "Cabang Asal": b.homeBranch || "Telkom",
      "Bertugas": b.workingBranch || "Telkom",
      "Status": b.status || "AKTIF",
      "Jumlah Customer": b.customers,
      "Jumlah Transaksi": b.transactions,
      "Total Omzet": b.omzet,
    }));
    exportToExcel(formatted, `Performa_Barberman_${filter}`);
  };

  const handleExportCSV = () => {
    const formatted = barberPerformance.map((b: any) => ({
      "Nama Barberman": b.name,
      "Cabang Asal": b.homeBranch || "Telkom",
      "Bertugas": b.workingBranch || "Telkom",
      "Status": b.status || "AKTIF",
      "Jumlah Customer": b.customers,
      "Jumlah Transaksi": b.transactions,
      "Total Omzet": b.omzet,
    }));
    exportToCSV(formatted, `Performa_Barberman_${filter}`);
  };

  return (
    <div className="space-y-6">
      {/* HEADER & FILTER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {isOwner ? "Pusat Monitoring" : "Dashboard Operasional"}
            </span>
            <span className="text-slate-300">•</span>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                isOwner
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : user?.role === "ADMIN_TELKOM"
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "bg-indigo-50 border-indigo-200 text-indigo-700"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                isOwner
                  ? "bg-amber-500"
                  : user?.role === "ADMIN_TELKOM"
                  ? "bg-blue-500"
                  : "bg-indigo-500"
              }`}></span>
              <span>
                {isOwner
                  ? "Semua Cabang (Telkom + Suta)"
                  : user?.role === "ADMIN_TELKOM"
                  ? "Cabang Telkom"
                  : "Cabang Suta"}
              </span>
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {isOwner
              ? "Monitoring Pusat Seluruh Cabang"
              : user?.role === "ADMIN_TELKOM"
              ? "Operasional Cabang Telkom"
              : user?.role === "ADMIN_SUTA"
              ? "Operasional Cabang Suta"
              : "Dashboard Operasional"}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isOwner
              ? "Ringkasan metrik gabungan Telkom & Suta, omzet, cash kasir, pergerakan stok, dan performa seluruh barber."
              : `Ringkasan performa penjualan kasir, antrean booking, dan stok produk ${
                  user?.role === "ADMIN_TELKOM" ? "Cabang Telkom" : "Cabang Suta"
                }.`}
          </p>
        </div>

        {/* DATE FILTER BUTTONS */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          {[
            { id: "today", label: "Hari Ini" },
            { id: "yesterday", label: "Kemarin" },
            { id: "week", label: "Minggu Ini" },
            { id: "month", label: "Bulan Ini" },
            { id: "year", label: "Tahun Ini" },
            { id: "custom", label: "Custom" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                filter === item.id
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* CUSTOM DATE RANGE PICKER (IF CUSTOM SELECTED) */}
      {filter === "custom" && (
        <form
          onSubmit={handleApplyCustom}
          className="p-4 bg-white rounded-2xl border border-slate-200 flex flex-wrap items-center gap-3 text-xs shadow-sm"
        >
          <span className="text-slate-700 font-bold">Rentang Tanggal:</span>
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium"
            required
          />
          <span className="text-slate-400">s/d</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium"
            required
          />
          <Button type="submit" size="sm" variant="primary">
            Terapkan Filter
          </Button>
        </form>
      )}

      {/* ── OWNER VIEW: MONITORING PERBANDINGAN CABANG ── */}
      {isOwner ? (
        <div className="space-y-5">

          {/* KARTU PERBANDINGAN 2 CABANG — ringkas, mendalam & eksekutif */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TELKOM */}
            <Card className="border-sky-200 bg-gradient-to-br from-sky-50 to-white shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-sky-600 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-white" />
                  <span className="font-black text-white text-sm tracking-wide">CABANG TELKOM</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-sky-100 text-[10px] font-bold uppercase">Operasional Aktif</span>
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-sky-100 text-center py-4">
                <div className="px-3">
                  <div className="text-[10px] font-bold text-sky-500 uppercase tracking-wider">Customer</div>
                  <div className="text-2xl font-black text-sky-900 mt-1">{telkomMetrics.todayCustomer}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">tamu dilayani</div>
                </div>
                <div className="px-3">
                  <div className="text-[10px] font-bold text-sky-500 uppercase tracking-wider">Transaksi</div>
                  <div className="text-2xl font-black text-sky-900 mt-1">{telkomMetrics.todayTransaction}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">struk kasir</div>
                </div>
                <div className="px-3">
                  <div className="text-[10px] font-bold text-sky-500 uppercase tracking-wider">Omzet Periode</div>
                  <div className="text-xl font-black text-sky-700 mt-1">{formatRupiah(telkomMetrics.todayRevenue)}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">layanan & produk</div>
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-sky-100 border-t border-sky-100 text-center py-3 bg-sky-50/50">
                <div className="px-3">
                  <div className="text-[10px] font-bold text-sky-600 uppercase">Cash di Laci</div>
                  <div className="text-sm font-black text-sky-900 mt-0.5">{formatRupiah(telkomMetrics.cashInHand || 0)}</div>
                </div>
                <div className="px-3">
                  <div className="text-[10px] font-bold text-sky-600 uppercase">Omzet Bulan Ini</div>
                  <div className="text-sm font-black text-sky-800 mt-0.5">{formatRupiah(telkomMetrics.monthRevenue)}</div>
                </div>
                <div className="px-3">
                  <div className="text-[10px] font-bold text-sky-600 uppercase">Booking Hari Ini</div>
                  <div className="text-sm font-black text-sky-900 mt-0.5">{telkomMetrics.todayBooking} reservasi</div>
                </div>
              </div>
            </Card>

            {/* SUTA */}
            <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-white shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-indigo-600 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-white" />
                  <span className="font-black text-white text-sm tracking-wide">CABANG SUTA</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-indigo-100 text-[10px] font-bold uppercase">Operasional Aktif</span>
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-indigo-100 text-center py-4">
                <div className="px-3">
                  <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Customer</div>
                  <div className="text-2xl font-black text-indigo-900 mt-1">{sutaMetrics.todayCustomer}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">tamu dilayani</div>
                </div>
                <div className="px-3">
                  <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Transaksi</div>
                  <div className="text-2xl font-black text-indigo-900 mt-1">{sutaMetrics.todayTransaction}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">struk kasir</div>
                </div>
                <div className="px-3">
                  <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Omzet Periode</div>
                  <div className="text-xl font-black text-indigo-700 mt-1">{formatRupiah(sutaMetrics.todayRevenue)}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">layanan & produk</div>
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-indigo-100 border-t border-indigo-100 text-center py-3 bg-indigo-50/50">
                <div className="px-3">
                  <div className="text-[10px] font-bold text-indigo-600 uppercase">Cash di Laci</div>
                  <div className="text-sm font-black text-indigo-900 mt-0.5">{formatRupiah(sutaMetrics.cashInHand || 0)}</div>
                </div>
                <div className="px-3">
                  <div className="text-[10px] font-bold text-indigo-600 uppercase">Omzet Bulan Ini</div>
                  <div className="text-sm font-black text-indigo-800 mt-0.5">{formatRupiah(sutaMetrics.monthRevenue)}</div>
                </div>
                <div className="px-3">
                  <div className="text-[10px] font-bold text-indigo-600 uppercase">Booking Hari Ini</div>
                  <div className="text-sm font-black text-indigo-900 mt-0.5">{sutaMetrics.todayBooking} reservasi</div>
                </div>
              </div>
            </Card>
          </div>

          {/* TOTAL GABUNGAN EKSEKUTIF (6 KARTU MONITORING OWNER) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="p-3.5 border-blue-200 bg-white shadow-sm text-center hover:border-blue-400 transition">
              <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Total Tamu</div>
              <div className="text-2xl font-black text-blue-900 mt-1">{totalMetrics.todayCustomer}</div>
              <div className="text-[10px] text-slate-400">Telkom + Suta</div>
            </Card>
            <Card className="p-3.5 border-blue-200 bg-white shadow-sm text-center hover:border-blue-400 transition">
              <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Total Struk</div>
              <div className="text-2xl font-black text-blue-900 mt-1">{totalMetrics.todayTransaction}</div>
              <div className="text-[10px] text-slate-400">Semua Struk</div>
            </Card>
            <Card className="p-3.5 border-emerald-200 bg-emerald-50/40 shadow-sm text-center hover:border-emerald-400 transition">
              <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Omzet Periode</div>
              <div className="text-lg font-black text-emerald-700 mt-1">{formatRupiah(totalMetrics.todayRevenue)}</div>
              <div className="text-[10px] text-emerald-600/70 font-semibold">Gabungan Cabang</div>
            </Card>
            <Card className="p-3.5 border-amber-200 bg-amber-50/40 shadow-sm text-center hover:border-amber-400 transition">
              <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Total Cash Fisik</div>
              <div className="text-lg font-black text-amber-700 mt-1">{formatRupiah(totalMetrics.cashInHand || 0)}</div>
              <div className="text-[10px] text-slate-400">Laci 2 Cabang</div>
            </Card>
            <Card className="p-3.5 border-purple-200 bg-white shadow-sm text-center hover:border-purple-400 transition">
              <div className="text-[10px] font-bold text-purple-500 uppercase tracking-wider">Total Booking</div>
              <div className="text-2xl font-black text-purple-900 mt-1">{totalMetrics.todayBooking}</div>
              <div className="text-[10px] text-slate-400">Reservasi Hari Ini</div>
            </Card>
            <Card className="p-3.5 border-indigo-200 bg-white shadow-sm text-center hover:border-indigo-400 transition">
              <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Omzet Bulan Ini</div>
              <div className="text-lg font-black text-indigo-700 mt-1">{formatRupiah(totalMetrics.monthRevenue)}</div>
              <div className="text-[10px] text-slate-400">Akumulasi Bulan</div>
            </Card>
          </div>
        </div>
      ) : (
        /* ── ADMIN VIEW: 10 KARTU METRIK KASIR CABANG (Section E, F, G) ── */
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Customer */}
          <Card className="hover:border-blue-300">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Customer</span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{metrics.todayCustomer}</div>
            <div className="text-[11px] text-slate-400 mt-1">Total tamu dilayani</div>
          </Card>

          {/* Card 2: Transaksi */}
          <Card className="hover:border-blue-300">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Transaksi</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{metrics.todayTransaction}</div>
            <div className="text-[11px] text-slate-400 mt-1">Struk tercetak</div>
          </Card>

          {/* Card 3: Omzet Terpilih */}
          <Card className="border-blue-200 bg-blue-50/60 hover:border-blue-400">
            <div className="flex items-center justify-between text-blue-800 text-xs font-bold">
              <span>Omzet Terpilih</span>
              <div className="p-2 rounded-xl bg-blue-600 text-white">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-blue-700">{formatRupiah(metrics.todayRevenue)}</div>
            <div className="text-[11px] text-blue-600/80 font-medium mt-1">Layanan + Produk</div>
          </Card>

          {/* Card 4: Omzet Bulan Ini */}
          <Card className="hover:border-blue-300">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Omzet Bulan Ini</span>
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{formatRupiah(metrics.monthRevenue)}</div>
            <div className="text-[11px] text-slate-400 mt-1">Akumulasi bulan berjalan</div>
          </Card>

          {/* Card 5: Cash Saat Ini */}
          <Card className="hover:border-blue-300">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Cash Saat Ini</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{formatRupiah(metrics.cashInHand)}</div>
            <div className="text-[11px] text-slate-400 mt-1">Uang fisik di laci</div>
          </Card>

          {/* Card 6: Booking Hari Ini */}
          <Card className="hover:border-blue-300">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Booking Hari Ini</span>
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <CalendarRange className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{metrics.todayBooking}</div>
            <div className="text-[11px] text-slate-400 mt-1">Jadwal reservasi</div>
          </Card>

          {/* Card 7: Total Member */}
          <Card className="hover:border-blue-300">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Total Member</span>
              <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{metrics.totalMember}</div>
            <div className="text-[11px] text-slate-400 mt-1">Member loyal aktif</div>
          </Card>

          {/* Card 8: Total Produk */}
          <Card className="hover:border-blue-300">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Total Produk</span>
              <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{metrics.totalProduct}</div>
            <div className="text-[11px] text-slate-400 mt-1">Katalog pomade & tonic</div>
          </Card>

          {/* Card 9: Hampir Habis */}
          <Card className="hover:border-blue-300">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Hampir Habis</span>
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-rose-600">{metrics.lowStockProducts}</div>
            <div className="text-[11px] text-rose-500 mt-1">Stok &lt; batas minimum</div>
          </Card>

          {/* Card 10: Penjualan Produk */}
          <Card className="hover:border-blue-300">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Penjualan Produk</span>
              <div className="p-2 rounded-xl bg-violet-50 text-violet-600">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{formatRupiah(metrics.productSalesRevenue)}</div>
            <div className="text-[11px] text-slate-400 mt-1">Retail grooming omzet</div>
          </Card>
        </div>
      )}

      {/* ── PERFORMA BARBERMAN TABLE (Section S, T, U) ── */}
      <Card className="overflow-hidden border-slate-200 shadow-sm p-0">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 font-bold">
              <Scissors className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-black text-slate-900">
                {isOwner ? "MONITORING 6 BARBERMAN (TELKOM & SUTA)" : "PERFORMA BARBERMAN CABANG"}
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Perhitungan jumlah customer unik, transaksi struk, dan total omzet layanan potong rambut.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleExportExcel} variant="secondary" size="sm">
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              Excel
            </Button>
            <Button onClick={handleExportCSV} variant="secondary" size="sm">
              <Printer className="w-3.5 h-3.5 mr-1 text-slate-600" />
              CSV
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Nama Barber</th>
                <th className="py-3 px-4 text-center">Cabang Asal</th>
                <th className="py-3 px-4 text-center">Bertugas Di</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Customer Dilayani</th>
                <th className="py-3 px-4 text-center">Transaksi</th>
                <th className="py-3 px-4 text-center">Layanan</th>
                <th className="py-3 px-4 text-right">Total Omzet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {barberPerformance.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Belum ada data performa barberman untuk filter ini.
                  </td>
                </tr>
              ) : (
                barberPerformance.map((b: any) => {
                  const isDiperbantukan = b.homeBranch && b.workingBranch && b.homeBranch !== b.workingBranch;
                  return (
                    <tr key={b.id} className="hover:bg-blue-50/40 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{b.name}</div>
                        <div className="text-[11px] text-slate-400">{b.nickname || "Stylist"}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-md font-semibold text-[11px] bg-slate-100 text-slate-700">
                          {b.homeBranch || "Telkom"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-md font-bold text-[11px] ${
                            b.workingBranch === "Telkom"
                              ? "bg-sky-50 text-sky-800 border border-sky-200"
                              : "bg-indigo-50 text-indigo-800 border border-indigo-200"
                          }`}
                        >
                          Cabang {b.workingBranch || "Telkom"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isDiperbantukan ? (
                          <Badge variant="gold">DIPERBANTUKAN</Badge>
                        ) : b.status === "LIBUR" ? (
                          <Badge variant="gray">Libur</Badge>
                        ) : (
                          <Badge variant="green">Aktif Bertugas</Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                          {b.customers} orang
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                          {b.transactions}x
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs">
                          {b.services || b.transactions || b.customers}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-blue-700 text-sm">
                        {formatRupiah(b.omzet || 0)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {barberPerformance.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-blue-500/30 bg-blue-50/70 font-bold text-xs">
                  <td colSpan={4} className="py-3 px-4 text-blue-900 font-extrabold uppercase">
                    TOTAL AKUMULASI OPERASIONAL
                  </td>
                  <td className="py-3 px-4 text-center text-blue-900 font-black">
                    {barberPerformance.reduce((acc: number, b: any) => acc + (b.customers || 0), 0)} orang
                  </td>
                  <td className="py-3 px-4 text-center text-blue-900 font-black">
                    {barberPerformance.reduce((acc: number, b: any) => acc + (b.transactions || 0), 0)}x
                  </td>
                  <td className="py-3 px-4 text-center text-blue-900 font-black">
                    {barberPerformance.reduce((acc: number, b: any) => acc + (b.services || b.transactions || b.customers || 0), 0)}
                  </td>
                  <td className="py-3 px-4 text-right text-blue-800 text-sm font-black">
                    {formatRupiah(barberPerformance.reduce((acc: number, b: any) => acc + (b.omzet || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* ── AKTIVITAS TERBARU (GABUNGAN TELKOM + SUTA UNTUK OWNER - Section BG) ── */}
      {isOwner && recentActivities.length > 0 && (
        <Card className="p-5 border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                Aktivitas Terbaru Seluruh Cabang
              </h3>
            </div>
            <Link href="/aktivitas" className="text-xs text-blue-600 hover:underline font-bold">
              Lihat Semua Log →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recentActivities.slice(0, 5).map((act: any) => (
              <div key={act.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`px-2 py-0.5 rounded font-bold text-[10px] shrink-0 ${
                      act.branch === "Telkom"
                        ? "bg-sky-50 text-sky-700 border border-sky-200"
                        : act.branch === "Suta"
                        ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {act.branch || "Semua"}
                  </span>
                  <span className="text-slate-800 font-medium truncate">{act.description}</span>
                </div>
                <span className="text-slate-400 text-[11px] whitespace-nowrap shrink-0">
                  {formatDateTimeIndo(new Date(act.createdAt))}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* QUICK SHORTCUTS GRID */}
      {isOwner ? (
        /* ── OWNER: 4 Link Monitoring & Laporan ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/laporan/cabang"
            className="p-5 rounded-2xl bg-white border border-sky-200 hover:border-sky-400 hover:shadow-lg hover:shadow-sky-500/10 transition group shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-2xl bg-sky-600 text-white">
                <Building2 className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-sky-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-4">Laporan Cabang</h3>
            <p className="text-xs text-slate-500 mt-1">
              Pantau dan terima laporan operasional dari Admin Telkom dan Admin Suta.
            </p>
          </Link>

          <Link
            href="/laporan/harian"
            className="p-5 rounded-2xl bg-white border border-indigo-200 hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-500/10 transition group shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-2xl bg-indigo-600 text-white">
                <TrendingUp className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-4">Laporan Keuangan</h3>
            <p className="text-xs text-slate-500 mt-1">
              Rekap omzet harian, mutasi kas, dan performa keuangan seluruh cabang.
            </p>
          </Link>

          <Link
            href="/barberman"
            className="p-5 rounded-2xl bg-white border border-blue-200 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/10 transition group shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-2xl bg-blue-600 text-white">
                <Scissors className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-4">Monitoring Barberman</h3>
            <p className="text-xs text-slate-500 mt-1">
              Pantau status dan performa 6 barberman Telkom & Suta secara real-time.
            </p>
          </Link>

          <Link
            href="/aktivitas"
            className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-400 hover:shadow-lg hover:shadow-slate-500/10 transition group shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-2xl bg-slate-700 text-white">
                <Clock className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-1 group-hover:-translate-y-1 transition" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-4">Log Aktivitas</h3>
            <p className="text-xs text-slate-500 mt-1">
              Riwayat lengkap aktivitas operasional seluruh cabang Telkom & Suta.
            </p>
          </Link>
        </div>
      ) : (
        /* ── ADMIN: Kasir + Transfer + Booking + Laporan ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/kasir"
            className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/10 transition group shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 font-bold">
                <Receipt className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-4">Kasir POS Cepat</h3>
            <p className="text-xs text-slate-500 mt-1">
              Mulai transaksi kasir baru, pilih layanan potong & pomade, cetak struk pembayaran.
            </p>
          </Link>

          <Link
            href="/transfer"
            className="p-5 rounded-2xl bg-gradient-to-br from-blue-50/90 to-indigo-50/50 border border-blue-200 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/10 transition group shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-2xl bg-blue-600 text-white font-bold">
                <ArrowLeftRight className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-blue-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-4">Transfer Produk</h3>
            <p className="text-xs text-slate-500 mt-1">
              Pindahkan stok pomade, toner, dan powder antar cabang Telkom dan Suta.
            </p>
          </Link>

          <Link
            href="/booking"
            className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/10 transition group shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-2xl bg-sky-50 text-sky-600 font-bold">
                <CalendarRange className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-4">Jadwal & Booking</h3>
            <p className="text-xs text-slate-500 mt-1">
              Lihat daftar antrean reservasi DP Rp20.000, verifikasi kehadiran, dan jadwal slot barber.
            </p>
          </Link>

          <Link
            href="/laporan/harian"
            className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/10 transition group shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 font-bold">
                <TrendingUp className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-4">Laporan Keuangan</h3>
            <p className="text-xs text-slate-500 mt-1">
              Rekapitulasi omzet harian, laba penjualan pomade, mutasi kas, dan performa tahunan.
            </p>
          </Link>
        </div>
      )}
    </div>
  );
}
