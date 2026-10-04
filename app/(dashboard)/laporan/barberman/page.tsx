"use client";

import React, { useState, useEffect } from "react";
import {
  Scissors,
  Printer,
  FileSpreadsheet,
  Users,
  TrendingUp,
  Building2,
  Calendar,
  Filter,
} from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRupiah } from "@/lib/utils";
import { exportToExcel, exportToCSV } from "@/lib/export";
import { ReportHeader } from "@/components/reports/report-header";
import { ReportFooter } from "@/components/reports/report-footer";

// Client-side cache for instant display
let _barbermanReportClientCache: Record<string, { stats: any[]; summary: any }> = {};

export default function LaporanBarbermanPage() {
  const [period, setPeriod] = useState<"daily" | "monthly" | "annual">("monthly");
  const [branch, setBranch] = useState<string>("All");
  const cacheKey = `${period}-${branch}`;
  const cached = _barbermanReportClientCache[cacheKey];

  const [selectedBarberId, setSelectedBarberId] = useState<string>("");
  const [statsData, setStatsData] = useState<any[]>(cached?.stats || []);
  const [summary, setSummary] = useState<any>(cached?.summary || { totalTransactions: 0, totalOmzet: 0, totalCustomers: 0 });
  const [loading, setLoading] = useState(!cached);

  const loadData = async () => {
    if (!_barbermanReportClientCache[cacheKey]) setLoading(true);
    try {
      const res = await fetch(`/api/barbermen/stats?period=${period}&branch=${branch}`);
      const json = await res.json();
      const list = Array.isArray(json.stats) ? json.stats : [];
      const sum = json.summary || { totalTransactions: 0, totalOmzet: 0, totalCustomers: 0 };
      _barbermanReportClientCache[cacheKey] = { stats: list, summary: sum };
      setStatsData(list);
      setSummary(sum);
      if (list.length > 0 && !selectedBarberId) {
        setSelectedBarberId(list[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (_barbermanReportClientCache[cacheKey]) {
      setStatsData(_barbermanReportClientCache[cacheKey].stats);
      setSummary(_barbermanReportClientCache[cacheKey].summary);
    }
    loadData();
  }, [period, branch]);

  const selectedBarber = statsData.find((b) => b.id === selectedBarberId) || statsData[0];

  const totalAllCust = summary.totalCustomers || 0;
  const totalAllTrans = summary.totalTransactions || 0;
  const totalAllOmzet = summary.totalOmzet || 0;

  const currentPeriodText =
    period === "daily"
      ? `Hari Ini (${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })})`
      : period === "monthly"
      ? new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" })
      : `Tahun ${new Date().getFullYear()}`;

  const handleExportAll = (type: "excel" | "csv") => {
    const formatted = statsData.map((p) => ({
      "Nama Barberman": p.name,
      "Home Branch": p.homeBranch,
      "Working Branch": p.workingBranch,
      "Customer Telkom": p.telkomCustomers,
      "Omzet Telkom": p.telkomOmzet,
      "Customer Suta": p.sutaCustomers,
      "Omzet Suta": p.sutaOmzet,
      "Total Customer": p.totalCustomers,
      "Total Transaksi": p.totalTransactions,
      "Total Omzet": p.totalOmzet,
      "Rata-rata per Tamu": p.averagePerCustomer,
      "Status": p.isActive !== false ? "Aktif" : "Libur",
    }));
    if (type === "excel") exportToExcel(formatted, `Laporan_Barberman_${period}_${branch}`);
    else exportToCSV(formatted, `Laporan_Barberman_${period}_${branch}`);
  };

  return (
    <div className="report-printable space-y-6">
      {/* KOP RESMI CETAK */}
      <ReportHeader
        title="LAPORAN KINERJA PER BARBERMAN"
        subtitle={`Cabang ${branch === "All" ? "Telkom & Suta (Gabungan)" : branch} — Periode ${currentPeriodText}`}
        periodText={currentPeriodText}
      />

      {/* HEADER WEB */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-wide flex items-center gap-2">
            <span>LAPORAN KINERJA BARBERMAN</span>
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-sm shadow-blue-500/50" />
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-blue-500" />
            Dihitung otomatis dari <strong>seluruh transaksi kasir</strong> di Supabase (Cross-Branch Attribution)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={() => handleExportAll("excel")} variant="outline" size="sm" className="border-slate-200 text-slate-700 bg-white hover:bg-slate-50">
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            Excel
          </Button>
          <Button onClick={() => window.print()} variant="primary" size="sm" className="shadow-md shadow-blue-500/20">
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Cetak / PDF
          </Button>
        </div>
      </div>

      {/* CONTROLS: PERIODE & CABANG */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-bold text-slate-700 mr-1">Periode:</span>
          <div className="inline-flex rounded-lg bg-white p-0.5 border border-slate-200 shadow-sm">
            <button
              onClick={() => setPeriod("daily")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                period === "daily" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Harian (Hari Ini)
            </button>
            <button
              onClick={() => setPeriod("monthly")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                period === "monthly" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Bulanan (Bulan Ini)
            </button>
            <button
              onClick={() => setPeriod("annual")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                period === "annual" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Tahunan (Tahun Ini)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-bold text-slate-700 mr-1">Cabang:</span>
          <div className="inline-flex rounded-lg bg-white p-0.5 border border-slate-200 shadow-sm">
            <button
              onClick={() => setBranch("All")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                branch === "All" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Semua Cabang
            </button>
            <button
              onClick={() => setBranch("Telkom")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                branch === "Telkom" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Telkom
            </button>
            <button
              onClick={() => setBranch("Suta")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                branch === "Suta" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Suta
            </button>
          </div>
        </div>
      </div>

      {/* SELECTOR BARBERMAN */}
      <div className="no-print flex flex-wrap gap-2">
        {statsData.map((b) => (
          <button
            key={b.id}
            onClick={() => setSelectedBarberId(b.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition ${
              selectedBarberId === b.id
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-105"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>💈 {b.name}</span>
            {b.totalCustomers > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                selectedBarberId === b.id ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"
              }`}>
                {b.totalCustomers}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* METRICS BARBERMAN TERPILIH */}
      {selectedBarber && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="card-stat p-4 bg-white border-blue-200 shadow-sm">
            <div className="text-xs text-blue-700 font-bold uppercase tracking-wider">
              Total Omzet
            </div>
            <div className="text-2xl font-black text-blue-700 mt-1">
              {formatRupiah(selectedBarber.totalOmzet || 0)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              💈 {selectedBarber.name} ({currentPeriodText})
            </div>
          </Card>

          <Card className="card-stat p-4 bg-white border-slate-200/80 shadow-sm">
            <div className="text-xs text-slate-500 uppercase font-semibold flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              Total Customer
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {selectedBarber.totalCustomers || 0} <span className="text-sm font-normal text-slate-400">orang</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Telkom: {selectedBarber.telkomCustomers || 0} | Suta: {selectedBarber.sutaCustomers || 0}
            </div>
          </Card>

          <Card className="card-stat p-4 bg-white border-slate-200/80 shadow-sm">
            <div className="text-xs text-slate-500 uppercase font-semibold">Total Transaksi</div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {selectedBarber.totalTransactions || 0}<span className="text-sm font-normal text-slate-400">x</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Layanan: {selectedBarber.serviceCount || 0} potong
            </div>
          </Card>

          <Card className="card-stat p-4 bg-white border-slate-200/80 shadow-sm">
            <div className="text-xs text-slate-500 uppercase font-semibold flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Avg per Tamu
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-1">
              {formatRupiah(selectedBarber.averagePerCustomer || 0)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Ticket size rata-rata</div>
          </Card>
        </div>
      )}

      {/* TABEL REKAP SEMUA BARBERMAN DENGAN CROSS-BRANCH ATTRIBUTION */}
      <Card className="border-slate-200/80 shadow-sm bg-white overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-900">
            Rekap Kinerja Barberman — Detail Antar Cabang
          </CardTitle>
          <Badge variant="blue">{currentPeriodText}</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 uppercase font-bold tracking-wider">
                <th className="py-2.5 px-3">Barberman</th>
                <th className="py-2.5 px-3 text-center">Home</th>
                <th className="py-2.5 px-3 text-center">Tugas Di</th>
                <th className="py-2.5 px-3 text-center bg-blue-50/50 text-blue-700">Telkom (Cust)</th>
                <th className="py-2.5 px-3 text-center bg-indigo-50/50 text-indigo-700">Suta (Cust)</th>
                <th className="py-2.5 px-3 text-center font-black">Total Cust</th>
                <th className="py-2.5 px-3 text-center">Transaksi</th>
                <th className="py-2.5 px-3 text-right">Total Omzet</th>
                <th className="py-2.5 px-3 text-right">Avg / Tamu</th>
                <th className="py-2.5 px-3 text-center no-print">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    Memuat data kinerja...
                  </td>
                </tr>
              ) : statsData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    Belum ada data transaksi pada periode ini.
                  </td>
                </tr>
              ) : (
                statsData.map((p, idx) => {
                  const isSelected = p.id === selectedBarberId;
                  return (
                    <tr
                      key={idx}
                      onClick={() => setSelectedBarberId(p.id)}
                      className={`transition-colors cursor-pointer ${
                        isSelected ? "bg-blue-50/70 font-bold" : "hover:bg-blue-50/30"
                      }`}
                    >
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-black text-xs no-print">
                            {p.name.charAt(0)}
                          </span>
                          <span>💈 {p.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500 font-medium">
                        {p.homeBranch || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.workingBranch === "Suta" ? "bg-indigo-100 text-indigo-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {p.workingBranch || "—"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center bg-blue-50/30">
                        <span className={`font-black ${p.telkomCustomers > 0 ? "text-blue-700" : "text-slate-300"}`}>
                          {p.telkomCustomers}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center bg-indigo-50/30">
                        <span className={`font-black ${p.sutaCustomers > 0 ? "text-indigo-700" : "text-slate-300"}`}>
                          {p.sutaCustomers}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-black text-slate-900 text-sm">
                        {p.totalCustomers}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600">{p.totalTransactions}x</td>
                      <td className="py-2.5 px-3 text-right font-black text-blue-700">{formatRupiah(p.totalOmzet || 0)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{formatRupiah(p.averagePerCustomer || 0)}</td>
                      <td className="py-2.5 px-3 text-center no-print">
                        {p.isActive !== false ? (
                          <Badge variant="green">Aktif</Badge>
                        ) : (
                          <Badge variant="red">Libur</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-xs">
                <td className="py-2.5 px-3 text-blue-700 font-black">TOTAL TIM ({statsData.length} Barber)</td>
                <td colSpan={4} className="py-2.5 px-3 text-center text-slate-400">—</td>
                <td className="py-2.5 px-3 text-center text-slate-900 font-black text-sm">{totalAllCust} cust</td>
                <td className="py-2.5 px-3 text-center text-slate-900">{totalAllTrans}x</td>
                <td className="py-2.5 px-3 text-right text-blue-700 font-black">{formatRupiah(totalAllOmzet)}</td>
                <td className="py-2.5 px-3 text-right text-slate-600">
                  {formatRupiah(totalAllCust > 0 ? totalAllOmzet / totalAllCust : 0)}
                </td>
                <td className="py-2.5 px-3 text-center text-slate-400 no-print">—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* TANDA TANGAN CETAK */}
      <ReportFooter signerName="Owner AD Barbershop" />
    </div>
  );
}
