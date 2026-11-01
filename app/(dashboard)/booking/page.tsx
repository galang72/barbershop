"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  CalendarRange,
  Plus,
  Clock,
  User,
  Scissors,
  CheckCircle,
  AlertCircle,
  XCircle,
  ArrowRight,
  Filter,
  Check,
  Edit2,
  Trash2,
  DollarSign,
  ShieldAlert,
  Search,
  UserPlus,
  X,
  CreditCard,
  Building,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { formatDateIndo, formatRupiah, getTodayDateWIB } from "@/lib/utils";

// ⚡ Module-level SWR cache — persists across navigations within the same session
let _bookingClientCache: { bookings: any[]; barbermen: any[]; services: any[] } | null = null;

export default function BookingPage() {
  const [bookings, setBookings] = useState<any[]>(_bookingClientCache?.bookings || []);
  const [loading, setLoading] = useState(!_bookingClientCache);
  const [selectedDate, setSelectedDate] = useState(getTodayDateWIB());
  const [selectedBranch, setSelectedBranch] = useState<string>("All");

  // User session
  const [session, setSession] = useState<any>(null);
  const isOwner = session?.role === "OWNER";

  // Notifications
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Master Data
  const [barbermen, setBarbermen] = useState<any[]>(_bookingClientCache?.barbermen || []);
  const [services, setServices] = useState<any[]>(_bookingClientCache?.services || []);

  // Customer Search Autocomplete for Modal
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Add Booking Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [branch, setBranch] = useState("Telkom");
  const [barbermanId, setBarbermanId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [bookingTime, setBookingTime] = useState("10:00");
  const [bookingDate, setBookingDate] = useState(getTodayDateWIB());
  const [status, setStatus] = useState("CONFIRMED");
  const [dpStatus, setDpStatus] = useState("BELUM_BAYAR");
  const [dpMethod, setDpMethod] = useState("QRIS");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit Booking Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [editCustName, setEditCustName] = useState("");
  const [editCustPhone, setEditCustPhone] = useState("");
  const [editBranch, setEditBranch] = useState("Telkom");
  const [editBarbermanId, setEditBarbermanId] = useState("");
  const [editServiceId, setEditServiceId] = useState("");
  const [editBookingDate, setEditBookingDate] = useState("");
  const [editBookingTime, setEditBookingTime] = useState("");
  const [editStatus, setEditStatus] = useState("CONFIRMED");
  const [editDpStatus, setEditDpStatus] = useState("BELUM_BAYAR");
  const [editDpMethod, setEditDpMethod] = useState("QRIS");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Quick DP Confirmation Modal State
  const [quickDpModalOpen, setQuickDpModalOpen] = useState(false);
  const [quickDpTarget, setQuickDpTarget] = useState<any>(null);
  const [quickDpMethod, setQuickDpMethod] = useState("QRIS");
  const [quickDpSubmitting, setQuickDpSubmitting] = useState(false);

  const fetchBookings = async (date?: string, br?: string) => {
    if (!_bookingClientCache) setLoading(true);
    try {
      const d = date || selectedDate;
      const b = br !== undefined ? br : selectedBranch;
      const url = `/api/bookings?date=${d}${b && b !== "All" ? `&branch=${b}` : ""}`;
      const res = await fetch(url);
      const json = await res.json();
      if (Array.isArray(json)) {
        setBookings(json);
        if (!date && b === "All") {
          _bookingClientCache = { bookings: json, barbermen, services };
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMasters = async () => {
    try {
      const [resB, resS, resSess] = await Promise.all([
        fetch("/api/barbermen?all=true"),
        fetch("/api/services"),
        fetch("/api/auth/me"),
      ]);
      const dataB = await resB.json();
      const dataS = await resS.json();
      const dataSess = await resSess.json();

      setSession(dataSess?.user || dataSess);

      const userBranch = dataSess?.user?.branch || dataSess?.branch || "Telkom";
      if (dataSess?.user?.role === "ADMIN_SUTA" || dataSess?.role === "ADMIN_SUTA") {
        setBranch("Suta");
        setSelectedBranch("Suta");
      } else if (dataSess?.user?.role === "ADMIN_TELKOM" || dataSess?.role === "ADMIN_TELKOM") {
        setBranch("Telkom");
        setSelectedBranch("Telkom");
      }

      const activeBarbermen = Array.isArray(dataB) ? dataB.filter((b: any) => b.isActive !== false) : [];
      setBarbermen(activeBarbermen);
      if (activeBarbermen.length > 0) setBarbermanId(activeBarbermen[0].id);

      const activeServices = Array.isArray(dataS) ? dataS.filter((s: any) => s.isActive !== false) : [];
      setServices(activeServices);
      if (activeServices.length > 0) setServiceId(activeServices[0].id);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadMasters();
  }, []);

  useEffect(() => {
    fetchBookings(selectedDate, selectedBranch);
  }, [selectedDate, selectedBranch]);

  // Debounced search customer
  useEffect(() => {
    if (!customerSearchQuery.trim()) {
      setCustomerSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers?query=${encodeURIComponent(customerSearchQuery.trim())}`);
        const data = await res.json();
        if (Array.isArray(data)) setCustomerSearchResults(data);
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearchQuery]);

  // Auto-hide alert banners
  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const t = setTimeout(() => setErrorMessage(null), 6000);
      return () => clearTimeout(t);
    }
  }, [errorMessage]);

  // Barbermen filtered by branch
  const getFilteredBarbermen = (targetBranch: string) => {
    return barbermen.filter((b) => {
      if (b.status === "DIPERBANTUKAN") return true;
      return b.branch === targetBranch || b.workingBranch === targetBranch;
    });
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !barbermanId || !serviceId) {
      alert("Harap lengkapi nama customer, barberman, dan layanan.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId || null,
          customerName: custName.trim(),
          customerPhone: custPhone.trim() || null,
          branch,
          barbermanId,
          serviceId,
          bookingDate,
          bookingTime,
          status,
          dpStatus,
          dpMethod: dpStatus === "SUDAH_DIBAYAR" ? dpMethod : null,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal membuat booking");
      }

      _bookingClientCache = null;
      setAddModalOpen(false);
      setCustName("");
      setCustPhone("");
      setSelectedCustomerId(null);
      setCustomerSearchQuery("");
      setNotes("");
      setDpStatus("BELUM_BAYAR");
      setSuccessMessage(`✅ Booking untuk ${custName} (${bookingTime}) di Cabang ${branch} berhasil dibuat!`);
      fetchBookings();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (b: any) => {
    setEditingBooking(b);
    setEditCustName(b.customerName || "");
    setEditCustPhone(b.customerPhone || "");
    setEditBranch(b.branch || "Telkom");
    setEditBarbermanId(b.barbermanId || (barbermen[0]?.id || ""));
    setEditServiceId(b.serviceId || (services[0]?.id || ""));
    const bDate = b.bookingDate ? new Date(b.bookingDate).toISOString().split("T")[0] : getTodayDateWIB();
    setEditBookingDate(bDate);
    setEditBookingTime(b.bookingTime || "10:00");
    setEditStatus(b.status || "CONFIRMED");
    setEditDpStatus(b.dpStatus || "BELUM_BAYAR");
    setEditDpMethod(b.dpMethod || "QRIS");
    setEditNotes(b.notes || "");
    setEditModalOpen(true);
  };

  const handleEditBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooking) return;

    setEditSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingBooking.id,
          customerName: editCustName.trim(),
          customerPhone: editCustPhone.trim() || null,
          branch: editBranch,
          barbermanId: editBarbermanId,
          serviceId: editServiceId,
          bookingDate: editBookingDate,
          bookingTime: editBookingTime,
          status: editStatus,
          dpStatus: editDpStatus,
          dpMethod: editDpStatus === "SUDAH_DIBAYAR" ? editDpMethod : null,
          notes: editNotes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memperbarui booking");
      }

      _bookingClientCache = null;
      setEditModalOpen(false);
      setSuccessMessage(`✅ Perubahan jadwal booking ${editCustName} berhasil disimpan ke Supabase.`);
      fetchBookings();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteBooking = async (id: string, customerName: string) => {
    if (!confirm(`Yakin ingin menghapus booking customer "${customerName}"? Data booking akan dihapus dari Supabase. Data customer & transaksi keuangan tetap aman.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/bookings?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus booking");
      }
      _bookingClientCache = null;
      setSuccessMessage(`✅ Booking "${customerName}" berhasil dihapus.`);
      fetchBookings();
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengubah status");
      _bookingClientCache = null;
      fetchBookings();
    } catch (e: any) {
      setErrorMessage(e.message);
    }
  };

  const handleQuickConfirmDp = (b: any) => {
    setQuickDpTarget(b);
    setQuickDpMethod("QRIS");
    setQuickDpModalOpen(true);
  };

  const handleQuickConfirmDpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickDpTarget) return;

    setQuickDpSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: quickDpTarget.id,
          dpStatus: "SUDAH_DIBAYAR",
          dpMethod: quickDpMethod,
          status: quickDpTarget.status === "PENDING" ? "CONFIRMED" : quickDpTarget.status,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal konfirmasi DP");

      _bookingClientCache = null;
      setQuickDpModalOpen(false);
      setSuccessMessage(`✅ Pembayaran DP Rp 20.000 (${quickDpMethod}) untuk ${quickDpTarget.customerName} berhasil dikonfirmasi dan dicatat ke kas.`);
      fetchBookings();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setQuickDpSubmitting(false);
    }
  };

  const getStatusBadge = (statusStr: string) => {
    switch (statusStr) {
      case "CONFIRMED":
        return <Badge variant="blue">Confirmed</Badge>;
      case "ARRIVED":
        return <Badge variant="gold">Arrived (Tiba)</Badge>;
      case "IN_PROGRESS":
        return <Badge variant="purple">In Progress</Badge>;
      case "COMPLETED":
        return <Badge variant="green">Completed</Badge>;
      case "CANCELLED":
        return <Badge variant="red">Cancelled</Badge>;
      case "NO_SHOW":
        return <Badge variant="gray">No Show</Badge>;
      case "RESCHEDULE":
        return <Badge variant="red">Reschedule</Badge>;
      case "TERLAMBAT":
        return <Badge variant="gold">Terlambat (Toleransi 15m)</Badge>;
      default:
        return <Badge variant="gray">Pending</Badge>;
    }
  };

  const getDpBadge = (b: any) => {
    const dpSt = b.dpStatus || "BELUM_BAYAR";
    switch (dpSt) {
      case "SUDAH_DIBAYAR":
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-600" />
            <span>DP Rp 20.000 ({b.dpMethod || "Lunas"})</span>
          </span>
        );
      case "LUNAS":
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
            🎉 Lunas di Kasir
          </span>
        );
      case "HANGUS":
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
            🔥 DP Hangus
          </span>
        );
      case "DIBATALKAN":
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            ❌ Dibatalkan
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            ⏳ Belum Bayar DP
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-wide flex items-center gap-2">
            <span>KALENDER & JADWAL BOOKING</span>
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-sm shadow-blue-500/50"></span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manajemen antrean reservasi potong rambut, status DP Rp 20.000, toleransi keterlambatan, dan integrasi kasir.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Branch Filter for Owner */}
          {isOwner && (
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-semibold shadow-sm focus:outline-none focus:border-blue-500"
            >
              <option value="All">📍 Semua Cabang</option>
              <option value="Telkom">Cabang Telkom</option>
              <option value="Suta">Cabang Suta</option>
            </select>
          )}

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-semibold shadow-sm focus:outline-none focus:border-blue-500"
          />

          {!isOwner && (
            <Button
              onClick={() => {
                setCustName("");
                setCustPhone("");
                setSelectedCustomerId(null);
                setNotes("");
                setDpStatus("BELUM_BAYAR");
                setAddModalOpen(true);
              }}
              variant="primary"
              size="sm"
              className="shadow-md shadow-blue-500/25"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Buat Booking
            </Button>
          )}
        </div>
      </div>

      {/* OWNER MONITORING BANNER */}
      {isOwner && (
        <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>Mode Monitoring (Owner): Anda memiliki akses melihat seluruh data booking kedua cabang. Penambahan dan pengeditan data hanya dapat dilakukan oleh Admin Cabang.</span>
        </div>
      )}

      {/* NOTIFICATIONS */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-800 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-800 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* QUICK STATUS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 border-slate-200 flex items-center justify-between bg-white shadow-sm">
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Total Booking</div>
            <div className="text-xl font-black text-slate-900">{bookings.length}</div>
          </div>
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
            <CalendarRange className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-3.5 border-slate-200 flex items-center justify-between bg-white shadow-sm">
          <div>
            <div className="text-[11px] text-slate-400 font-medium">DP Diterima (Rp)</div>
            <div className="text-xl font-black text-emerald-700">
              {formatRupiah(
                bookings.filter((b) => b.dpStatus === "SUDAH_DIBAYAR" || b.dpStatus === "LUNAS").length * 20000
              )}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
            <DollarSign className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-3.5 border-slate-200 flex items-center justify-between bg-white shadow-sm">
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Hadir / Sedang Potong</div>
            <div className="text-xl font-black text-blue-700">
              {bookings.filter((b) => b.status === "ARRIVED" || b.status === "IN_PROGRESS" || b.status === "TERLAMBAT").length}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
            <Scissors className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-3.5 border-slate-200 flex items-center justify-between bg-white shadow-sm">
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Selesai (Completed)</div>
            <div className="text-xl font-black text-emerald-600">
              {bookings.filter((b) => b.status === "COMPLETED").length}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* BOOKING LIST TABLE */}
      <Card className="p-0 overflow-hidden border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                <th className="py-3.5 px-4">Jam</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Barberman</th>
                <th className="py-3.5 px-4">Layanan</th>
                <th className="py-3.5 px-4">Cabang</th>
                <th className="py-3.5 px-4 text-center">Status Kehadiran</th>
                <th className="py-3.5 px-4 text-center">Status DP (Rp 20.000)</th>
                <th className="py-3.5 px-4 text-center">Aksi & Kasir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Memuat antrean booking...</span>
                    </div>
                  </td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    Tidak ada jadwal booking untuk tanggal {formatDateIndo(selectedDate)}.
                  </td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-3.5 px-4 font-black text-blue-700 text-sm whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-500" />
                        <span>{b.bookingTime}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span>{b.customerName}</span>
                        {b.customer?.members && b.customer.members.some((m: any) => m.status === "ACTIVE" && new Date(m.endDate) >= new Date()) && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-600 text-white font-extrabold tracking-wide">
                            MEMBER
                          </span>
                        )}
                      </div>
                      {b.customerPhone && (
                        <div className="text-[11px] text-slate-500 font-normal">📞 {b.customerPhone}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-blue-700">
                      <div>💈 {b.barberman?.name || "-"}</div>
                      {b.barberman?.status === "DIPERBANTUKAN" && (
                        <div className="text-[10px] text-amber-600 font-normal">
                          Diperbantukan dari {b.barberman?.homeBranch}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-800 font-medium">
                      ✂️ {b.service?.name || "-"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        b.branch === "Telkom"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-indigo-50 text-indigo-700 border-indigo-200"
                      }`}>
                        📍 {b.branch || "Telkom"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {getStatusBadge(b.status)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {getDpBadge(b)}
                        {!isOwner && b.dpStatus === "BELUM_BAYAR" && b.status !== "CANCELLED" && b.status !== "COMPLETED" && (
                          <button
                            onClick={() => handleQuickConfirmDp(b)}
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer mt-0.5"
                          >
                            + Konfirmasi DP
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {!isOwner && (
                          <select
                            value={b.status}
                            onChange={(e) => handleUpdateStatus(b.id, e.target.value)}
                            disabled={b.status === "COMPLETED"}
                            className="bg-slate-50 border border-slate-200 text-xs text-slate-800 font-semibold rounded-lg px-2 py-1 focus:outline-none focus:border-blue-600 disabled:opacity-50"
                          >
                            <option value="PENDING">Pending</option>
                            <option value="CONFIRMED">Confirmed</option>
                            <option value="ARRIVED">Arrived (Hadir)</option>
                            <option value="TERLAMBAT">Terlambat (DP Aman)</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="RESCHEDULE">Reschedule (DP Hangus)</option>
                            <option value="CANCELLED">Cancelled</option>
                            <option value="NO_SHOW">No Show (DP Hangus)</option>
                          </select>
                        )}

                        {b.status !== "COMPLETED" && b.status !== "CANCELLED" && b.status !== "NO_SHOW" && b.status !== "RESCHEDULE" && (
                          <Link
                            href="/kasir"
                            className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 font-bold text-xs transition border border-blue-200"
                          >
                            Ke Kasir
                          </Link>
                        )}

                        {!isOwner && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(b)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition"
                              title="Edit Booking"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteBooking(b.id, b.customerName)}
                              disabled={b.status === "COMPLETED"}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-30 disabled:hover:text-slate-300 disabled:hover:bg-transparent"
                              title={b.status === "COMPLETED" ? "Booking selesai tidak dapat dihapus" : "Hapus Booking"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL BUAT BOOKING BARU */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Buat Jadwal Booking Baru"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateBooking} className="space-y-4">
          {/* Customer Search / Autocomplete */}
          <div className="relative" ref={searchRef}>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nama Customer <span className="text-rose-500 font-bold">* Wajib</span>
            </label>
            <input
              type="text"
              required
              value={custName}
              onChange={(e) => {
                setCustName(e.target.value);
                setCustomerSearchQuery(e.target.value);
                setSelectedCustomerId(null);
              }}
              placeholder="Ketik nama untuk cari customer lama atau input baru..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
            />
            {customerSearchResults.length > 0 && custName.trim() && !selectedCustomerId && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-blue-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                <div className="px-3 py-1 bg-blue-50 border-b border-blue-100 text-[10px] font-bold text-blue-700 uppercase">
                  Pilih Customer Terdaftar
                </div>
                {customerSearchResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCustName(c.name);
                      setCustPhone(c.phone || "");
                      setSelectedCustomerId(c.id);
                      setCustomerSearchResults([]);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 transition border-b border-slate-50 last:border-0 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{c.name}</div>
                      <div className="text-[10px] text-slate-400">📞 {c.phone || "Tanpa No HP"}</div>
                    </div>
                    {c.members && c.members.some((m: any) => m.status === "ACTIVE" && new Date(m.endDate) >= new Date()) && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-600 text-white font-bold">
                        MEMBER
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              No. HP / WhatsApp
            </label>
            <input
              type="text"
              value={custPhone}
              onChange={(e) => setCustPhone(e.target.value)}
              placeholder="081234567890"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Cabang
              </label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                disabled={session?.role === "ADMIN_TELKOM" || session?.role === "ADMIN_SUTA"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:bg-white focus:border-blue-600 disabled:opacity-60"
              >
                <option value="Telkom">Cabang Telkom</option>
                <option value="Suta">Cabang Suta</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Pilih Barberman
              </label>
              <select
                value={barbermanId}
                onChange={(e) => setBarbermanId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-medium focus:outline-none focus:bg-white focus:border-blue-600"
              >
                {getFilteredBarbermen(branch).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.status === "DIPERBANTUKAN" ? ` — Diperbantukan` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Pilih Layanan
            </label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-medium focus:outline-none focus:bg-white focus:border-blue-600"
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({formatRupiah(s.price)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tanggal Booking
              </label>
              <input
                type="date"
                required
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Jam Booking
              </label>
              <input
                type="time"
                required
                value={bookingTime}
                onChange={(e) => setBookingTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600 font-bold"
              />
            </div>
          </div>

          {/* STATUS PEMBAYARAN DP */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              Status Pembayaran DP (Rp 20.000)
            </label>
            <select
              value={dpStatus}
              onChange={(e) => setDpStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
            >
              <option value="BELUM_BAYAR">⏳ Belum Bayar DP (Default Reservasi)</option>
              <option value="SUDAH_DIBAYAR">✅ DP Dibayar (Rp 20.000 Diterima)</option>
            </select>

            {dpStatus === "SUDAH_DIBAYAR" && (
              <div className="pt-1">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Metode Pembayaran DP
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["QRIS", "CASH", "TRANSFER"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDpMethod(m)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition ${
                        dpMethod === m
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Catatan Khusus (Opsional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Model potongan taper fade, cuci rambut, dll"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            variant="primary"
            className="w-full font-bold shadow-md shadow-blue-500/25"
          >
            {submitting ? "Menyimpan ke Supabase..." : "Konfirmasi & Simpan Booking"}
          </Button>
        </form>
      </Modal>

      {/* MODAL EDIT BOOKING */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit Booking: ${editCustName}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleEditBookingSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nama Customer <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={editCustName}
              onChange={(e) => setEditCustName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              No. HP / WhatsApp
            </label>
            <input
              type="text"
              value={editCustPhone}
              onChange={(e) => setEditCustPhone(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Cabang
              </label>
              <select
                value={editBranch}
                onChange={(e) => setEditBranch(e.target.value)}
                disabled={session?.role === "ADMIN_TELKOM" || session?.role === "ADMIN_SUTA"}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:bg-white focus:border-blue-600 disabled:opacity-60"
              >
                <option value="Telkom">Cabang Telkom</option>
                <option value="Suta">Cabang Suta</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Barberman
              </label>
              <select
                value={editBarbermanId}
                onChange={(e) => setEditBarbermanId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-medium focus:outline-none focus:bg-white focus:border-blue-600"
              >
                {getFilteredBarbermen(editBranch).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.status === "DIPERBANTUKAN" ? ` — Diperbantukan` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Layanan
            </label>
            <select
              value={editServiceId}
              onChange={(e) => setEditServiceId(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-medium focus:outline-none focus:bg-white focus:border-blue-600"
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({formatRupiah(s.price)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tanggal Booking
              </label>
              <input
                type="date"
                required
                value={editBookingDate}
                onChange={(e) => setEditBookingDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-semibold focus:outline-none focus:bg-white focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Jam Booking
              </label>
              <input
                type="time"
                required
                value={editBookingTime}
                onChange={(e) => setEditBookingTime(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Status Kehadiran
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
              >
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="ARRIVED">Arrived (Hadir)</option>
                <option value="TERLAMBAT">Terlambat (Toleransi 15m)</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="RESCHEDULE">Reschedule (DP Hangus)</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="NO_SHOW">No Show (DP Hangus)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Status DP
              </label>
              <select
                value={editDpStatus}
                onChange={(e) => setEditDpStatus(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
              >
                <option value="BELUM_BAYAR">Belum Bayar DP</option>
                <option value="SUDAH_DIBAYAR">DP Dibayar (Rp 20.000)</option>
                <option value="LUNAS">Lunas di Kasir</option>
                <option value="HANGUS">DP Hangus</option>
                <option value="DIBATALKAN">Dibatalkan</option>
              </select>
            </div>
          </div>

          {editDpStatus === "SUDAH_DIBAYAR" && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Metode Pembayaran DP
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["QRIS", "CASH", "TRANSFER"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setEditDpMethod(m)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition ${
                      editDpMethod === m
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Catatan
            </label>
            <textarea
              rows={2}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
            />
          </div>

          <Button
            type="submit"
            disabled={editSaving}
            variant="primary"
            className="w-full font-bold shadow-md shadow-blue-500/25"
          >
            {editSaving ? "Menyimpan Perubahan..." : "Simpan Perubahan ke Supabase"}
          </Button>
        </form>
      </Modal>

      {/* MODAL KONFIRMASI DP CEPAT */}
      <Modal
        isOpen={quickDpModalOpen}
        onClose={() => setQuickDpModalOpen(false)}
        title={`Konfirmasi DP: ${quickDpTarget?.customerName}`}
        maxWidth="max-w-sm"
      >
        <form onSubmit={handleQuickConfirmDpSubmit} className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 space-y-1">
            <div className="font-bold">Nominal Down Payment (DP):</div>
            <div className="text-xl font-black text-blue-700">Rp 20.000</div>
            <div className="text-[11px] text-blue-600">
              Konfirmasi ini akan mencatat kas masuk Rp 20.000 pada Cabang {quickDpTarget?.branch || "Telkom"}.
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Pilih Metode Pembayaran
            </label>
            <div className="grid grid-cols-3 gap-2">
              {["QRIS", "CASH", "TRANSFER"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setQuickDpMethod(m)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition ${
                    quickDpMethod === m
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            disabled={quickDpSubmitting}
            variant="primary"
            className="w-full font-bold shadow-md shadow-blue-500/25"
          >
            {quickDpSubmitting ? "Memproses..." : "Konfirmasi Pembayaran DP"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
