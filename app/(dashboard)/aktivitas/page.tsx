"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  Clock,
  Building2,
  User,
  Filter,
  RefreshCw,
  Search,
  CheckCircle2,
  ArrowLeftRight,
  ShoppingCart,
  Calendar,
  DollarSign,
  Package,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeIndo } from "@/lib/utils";

// Client-side cache for instant display
let _aktivitasClientCache: Record<string, { activities: any[]; session: any }> = {};

export default function AktivitasPage() {
  const [branchFilter, setBranchFilter] = useState("All");
  const cached = _aktivitasClientCache[branchFilter];
  const [activities, setActivities] = useState<any[]>(cached?.activities || []);
  const [loading, setLoading] = useState(!cached);
  const [session, setSession] = useState<any>(cached?.session || null);
  const [search, setSearch] = useState("");

  const loadActivities = async () => {
    if (!_aktivitasClientCache[branchFilter]) setLoading(true);
    try {
      const [resAct, resSess] = await Promise.all([
        fetch(`/api/activities?branch=${branchFilter}`),
        fetch("/api/auth/me"),
      ]);
      const dataAct = await resAct.json();
      const dataSess = await resSess.json();
      const acts = dataAct.activities || [];
      const sess = dataSess?.user;
      _aktivitasClientCache[branchFilter] = { activities: acts, session: sess };
      setActivities(acts);
      setSession(sess);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (_aktivitasClientCache[branchFilter]) {
      setActivities(_aktivitasClientCache[branchFilter].activities);
      setSession(_aktivitasClientCache[branchFilter].session);
    }
    loadActivities();
  }, [branchFilter]);

  const isOwner = session?.role === "OWNER";

  const getActionBadge = (action: string) => {
    switch (action) {
      case "TRANSAKSI_KASIR":
        return <Badge variant="blue"><ShoppingCart className="w-3 h-3 mr-1" /> Transaksi</Badge>;
      case "BOOKING_BARU":
        return <Badge variant="purple"><Calendar className="w-3 h-3 mr-1" /> Booking</Badge>;
      case "BOOKING_RESCHEDULE":
        return <Badge variant="red"><Clock className="w-3 h-3 mr-1" /> Reschedule</Badge>;
      case "BOOKING_TERLAMBAT":
        return <Badge variant="gold"><Clock className="w-3 h-3 mr-1" /> Terlambat</Badge>;
      case "TRANSFER_PRODUK":
        return <Badge variant="gold"><ArrowLeftRight className="w-3 h-3 mr-1" /> Transfer</Badge>;
      case "PENUGASAN_BARBER":
        return <Badge variant="green"><User className="w-3 h-3 mr-1" /> Penugasan</Badge>;
      case "CASH_MANAGEMENT":
        return <Badge variant="blue"><DollarSign className="w-3 h-3 mr-1" /> Kas</Badge>;
      default:
        return <Badge variant="gray"><Shield className="w-3 h-3 mr-1" /> {action}</Badge>;
    }
  };

  const filtered = activities.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (a.description || "").toLowerCase().includes(q) ||
      (a.actor || "").toLowerCase().includes(q) ||
      (a.action || "").toLowerCase().includes(q) ||
      (a.branch || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-wide flex items-center gap-2">
            <span>LOG AKTIVITAS SISTEM</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] bg-blue-600 text-white font-extrabold shadow-sm">
              AUDIT LOG
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit trail riwayat transaksi kasir, booking, transfer produk, penugasan barber, dan arus kas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Branch filter (hanya tampil jika Owner) */}
          {isOwner && (
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-sm text-xs font-semibold">
              <span className="text-slate-400 pl-2">Cabang:</span>
              {["All", "Telkom", "Suta"].map((b) => (
                <button
                  key={b}
                  onClick={() => setBranchFilter(b)}
                  className={`px-3 py-1 rounded-lg transition ${
                    branchFilter === b
                      ? "bg-blue-600 text-white font-bold"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {b === "All" ? "Semua" : b}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={loadActivities}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-slate-50 shadow-sm transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari aktivitas, pelaku, atau keterangan..."
          className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
        />
      </div>

      {/* ACTIVITY TIMELINE TABLE */}
      <Card className="overflow-hidden border-slate-200 shadow-sm p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Waktu</th>
                <th className="py-3.5 px-4">Tipe Aktivitas</th>
                <th className="py-3.5 px-4">Cabang</th>
                <th className="py-3.5 px-4">Pelaku / Aktor</th>
                <th className="py-3.5 px-4">Deskripsi Rincian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-600 mb-2" />
                    Memuat log aktivitas...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Belum ada riwayat aktivitas yang tercatat.
                  </td>
                </tr>
              ) : (
                filtered.map((a: any) => (
                  <tr key={a.id} className="hover:bg-blue-50/40 transition">
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {formatDateTimeIndo(new Date(a.createdAt))}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getActionBadge(a.action)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-bold text-[11px] ${
                          a.branch === "Telkom"
                            ? "bg-sky-50 text-sky-700 border border-sky-200"
                            : a.branch === "Suta"
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        <Building2 className="w-3 h-3" />
                        {a.branch || "Semua"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                      {a.actor || "Sistem"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium leading-relaxed">
                      {a.description}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
