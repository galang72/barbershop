"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  Search,
  Plus,
  RotateCw,
  FileSpreadsheet,
  Users,
  Trash2,
  Edit2,
  Eye,
  CheckCircle2,
  AlertCircle,
  X,
  Calendar,
  Clock,
  Scissors,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { formatRupiah, formatDateIndo } from "@/lib/utils";
import { exportToExcel, exportToCSV } from "@/lib/export";

// ⚡ Module-level SWR cache — persists across navigations within the same session
let _memberClientCache: any[] | null = null;

export default function MemberPage() {
  const [members, setMembers] = useState<any[]>(_memberClientCache || []);
  const [loading, setLoading] = useState(!_memberClientCache);
  const [search, setSearch] = useState("");

  // Notifications
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal Registrasi Member Baru
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [packageName, setPackageName] = useState("VIP 6 Bulan (180 Hari)");
  const [durationDays, setDurationDays] = useState(180);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Extend Modal
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [extending, setExtending] = useState(false);

  // Edit Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editMemberData, setEditMemberData] = useState<any>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [memberDetail, setMemberDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchMembers = async (q?: string) => {
    if (!_memberClientCache) setLoading(true);
    try {
      const url = q ? `/api/members?q=${encodeURIComponent(q)}` : "/api/members";
      const res = await fetch(url);
      const json = await res.json();
      if (Array.isArray(json)) {
        setMembers(json);
        if (!q) _memberClientCache = json;
      }
    } catch (e) {
      console.error("Gagal memuat data member:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers(search);
  }, [search]);

  // Auto-hide notifications after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const t = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [errorMessage]);

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Nama member wajib diisi!");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          packageName,
          durationDays,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Gagal membuat member");
      }

      _memberClientCache = null;
      setAddModalOpen(false);
      setName("");
      setPhone("");
      setFormError(null);
      setSuccessMessage(
        `✅ Member ${json.member?.name} berhasil didaftarkan! Kode: ${json.member?.memberCode}. Diskon 10% potong rambut aktif.`
      );
      fetchMembers();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExtendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setExtending(true);
    try {
      const res = await fetch("/api/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedMember.id,
          additionalDays: extendDays,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memperpanjang masa aktif");

      _memberClientCache = null;
      setExtendModalOpen(false);
      setSuccessMessage(`✅ Masa aktif member ${selectedMember.name} berhasil diperpanjang +${extendDays} hari.`);
      fetchMembers();
    } catch (e: any) {
      setErrorMessage(e.message);
    } finally {
      setExtending(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMemberData) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch("/api/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editMemberData.id,
          name: editMemberData.name,
          phone: editMemberData.phone,
          packageName: editMemberData.packageName,
          status: editMemberData.status,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan perubahan member");

      _memberClientCache = null;
      setEditModalOpen(false);
      setSuccessMessage(`✅ Perubahan profil member ${editMemberData.name} berhasil disimpan.`);
      fetchMembers();
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteMember = async (id: string, memberName: string) => {
    if (!confirm(`Yakin ingin menghapus member "${memberName}"? Data membership akan dihapus permanen dari Supabase.`)) return;
    try {
      const res = await fetch(`/api/members?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        _memberClientCache = null;
        setSuccessMessage(`✅ Member ${memberName} berhasil dihapus.`);
        fetchMembers();
      } else {
        const err = await res.json();
        setErrorMessage(err.error || "Gagal menghapus member");
      }
    } catch (e: any) {
      setErrorMessage(e.message);
    }
  };

  const handleOpenDetail = async (memberId: string) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const res = await fetch(`/api/members?id=${memberId}`);
      if (res.ok) {
        const data = await res.json();
        setMemberDetail(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleExport = (type: "excel" | "csv") => {
    const formatted = members.map((m) => ({
      "ID Member": m.memberCode,
      "Nama Member": m.name,
      "No. Telepon": m.phone || "-",
      "Paket": m.packageName,
      "Masa Berlaku": formatDateIndo(m.endDate),
      "Status": m.status,
      "Total Kunjungan": m.totalVisits,
      "Total Pengeluaran": m.totalSpend,
    }));
    if (type === "excel") exportToExcel(formatted, "Daftar_Member_AD_Barbershop");
    else exportToCSV(formatted, "Daftar_Member_AD_Barbershop");
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-wide flex items-center gap-2">
            <span>MEMBERSHIP AD BARBERSHOP</span>
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-sm shadow-blue-500/50"></span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manajemen keanggotaan loyal, diskon otomatis 10% potong rambut di kasir, dan riwayat kunjungan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => handleExport("excel")} variant="outline" size="sm" className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700">
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            Excel
          </Button>
          <Button
            onClick={() => {
              setFormError(null);
              setAddModalOpen(true);
            }}
            variant="primary"
            size="sm"
            className="shadow-md shadow-blue-500/20"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            + Tambah Member
          </Button>
        </div>
      </div>

      {/* NOTIFICATION BANNERS */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between animate-fade-in shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-800 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between animate-fade-in shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-800 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SEARCH BAR */}
      <Card className="p-4 border-slate-200/80 shadow-sm bg-white">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari berdasarkan ID Member (AD-MBR-xxx), Nama Pelanggan, atau Nomor HP..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
          />
        </div>
      </Card>

      {/* MEMBER TABLE */}
      <Card className="border-slate-200/80 shadow-sm bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold uppercase text-slate-500 tracking-wider">
                <th className="py-3.5 px-4">ID Member</th>
                <th className="py-3.5 px-4">Nama Pelanggan</th>
                <th className="py-3.5 px-4">Paket Membership</th>
                <th className="py-3.5 px-4">Masa Berlaku</th>
                <th className="py-3.5 px-4 text-center">Kunjungan</th>
                <th className="py-3.5 px-4 text-right">Total Belanja</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p className="text-xs">Memuat data member...</p>
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">Belum ada member yang terdaftar</p>
                    <p className="text-xs text-slate-400 mt-1">Klik "+ Tambah Member" di atas untuk mendaftarkan member baru.</p>
                  </td>
                </tr>
              ) : (
                members.map((m) => {
                  const isExpired = new Date(m.endDate) < new Date();
                  const isActive = m.status === "ACTIVE" && !isExpired;

                  return (
                    <tr key={m.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-700 text-xs">
                        {m.memberCode}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div>{m.name}</div>
                        {m.phone && <div className="text-xs text-slate-500 font-normal">📞 {m.phone}</div>}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold">
                        <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                          {m.packageName}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {formatDateIndo(m.endDate)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold">
                          {m.totalVisits || 0}x
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-blue-700">
                        {formatRupiah(m.totalSpend || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isActive ? (
                          <Badge variant="green">Aktif</Badge>
                        ) : isExpired ? (
                          <Badge variant="red">Expired</Badge>
                        ) : (
                          <Badge variant="gray">Nonaktif</Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenDetail(m.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                            title="Detail & Riwayat Member"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <Button
                            onClick={() => {
                              setSelectedMember(m);
                              setExtendModalOpen(true);
                            }}
                            variant="outline"
                            size="sm"
                            className="text-xs border-blue-200 text-blue-700 hover:bg-blue-50 py-1 px-2.5 h-auto"
                          >
                            <RotateCw className="w-3 h-3 mr-1 text-blue-600" />
                            Perpanjang
                          </Button>
                          <button
                            onClick={() => {
                              setEditMemberData({
                                id: m.id,
                                name: m.name,
                                phone: m.phone || "",
                                packageName: m.packageName,
                                status: m.status,
                              });
                              setEditError(null);
                              setEditModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition"
                            title="Edit Data Member"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMember(m.id, m.name)}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition"
                            title="Hapus member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL REGISTRASI MEMBER */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Daftarkan Member Baru"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateMember} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Member <span className="text-rose-500 font-bold">* Wajib</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Kevin Sanjaya"
              className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nomor WhatsApp / HP
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="081234567890"
              className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Pilih Paket Membership
            </label>
            <select
              value={packageName}
              onChange={(e) => {
                setPackageName(e.target.value);
                if (e.target.value.includes("1 Bulan")) setDurationDays(30);
                else if (e.target.value.includes("3 Bulan")) setDurationDays(90);
                else if (e.target.value.includes("6 Bulan")) setDurationDays(180);
                else if (e.target.value.includes("1 Tahun")) setDurationDays(365);
              }}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition font-medium"
            >
              <option value="Silver 1 Bulan (30 Hari)">Silver 1 Bulan (30 Hari)</option>
              <option value="Gold 3 Bulan (90 Hari)">Gold 3 Bulan (90 Hari)</option>
              <option value="VIP 6 Bulan (180 Hari)">VIP 6 Bulan (180 Hari)</option>
              <option value="Platinum 1 Tahun (365 Hari)">Platinum 1 Tahun (365 Hari)</option>
            </select>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5" />
              <span>Ketentuan Keanggotaan:</span>
            </div>
            <ul className="list-disc list-inside text-[11px] text-blue-600 space-y-0.5">
              <li>Diskon 10% otomatis khusus layanan potong rambut (Haircut).</li>
              <li>Produk dan treatment lain tidak mendapatkan diskon member.</li>
              <li>Tersimpan permanen di Supabase dan terhubung ke profil Customer.</li>
            </ul>
          </div>

          <Button
            type="submit"
            disabled={saving}
            variant="primary"
            className="w-full font-bold shadow-md shadow-blue-500/20"
          >
            {saving ? "Mendaftarkan ke Supabase..." : "Aktifkan Membership"}
          </Button>
        </form>
      </Modal>

      {/* MODAL PERPANJANG MEMBER */}
      <Modal
        isOpen={extendModalOpen}
        onClose={() => setExtendModalOpen(false)}
        title={`Perpanjang Member: ${selectedMember?.name}`}
        maxWidth="max-w-sm"
      >
        <form onSubmit={handleExtendSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tambah Masa Berlaku
            </label>
            <select
              value={extendDays}
              onChange={(e) => setExtendDays(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition font-medium"
            >
              <option value={30}>+ 1 Bulan (30 Hari)</option>
              <option value={90}>+ 3 Bulan (90 Hari)</option>
              <option value={180}>+ 6 Bulan (180 Hari)</option>
              <option value={365}>+ 1 Tahun (365 Hari)</option>
            </select>
          </div>

          <Button type="submit" disabled={extending} variant="primary" className="w-full font-bold shadow-md shadow-blue-500/20">
            {extending ? "Menyimpan..." : "Konfirmasi Perpanjangan"}
          </Button>
        </form>
      </Modal>

      {/* MODAL EDIT MEMBER */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit Profil Member: ${editMemberData?.name}`}
        maxWidth="max-w-md"
      >
        {editMemberData && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {editError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Member</label>
              <input
                type="text"
                required
                value={editMemberData.name}
                onChange={(e) => setEditMemberData({ ...editMemberData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor WhatsApp / HP</label>
              <input
                type="text"
                value={editMemberData.phone}
                onChange={(e) => setEditMemberData({ ...editMemberData, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Paket Membership</label>
              <input
                type="text"
                value={editMemberData.packageName}
                onChange={(e) => setEditMemberData({ ...editMemberData, packageName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status Keanggotaan</label>
              <select
                value={editMemberData.status}
                onChange={(e) => setEditMemberData({ ...editMemberData, status: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white font-medium"
              >
                <option value="ACTIVE">ACTIVE (Aktif)</option>
                <option value="EXPIRED">EXPIRED (Kedaluwarsa)</option>
                <option value="INACTIVE">INACTIVE (Nonaktif)</option>
              </select>
            </div>

            <Button type="submit" disabled={editSaving} variant="primary" className="w-full font-bold shadow-md shadow-blue-500/20">
              {editSaving ? "Menyimpan Perubahan..." : "Simpan Perubahan"}
            </Button>
          </form>
        )}
      </Modal>

      {/* MODAL DETAIL & RIWAYAT MEMBER */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setMemberDetail(null);
        }}
        title="Detail & Riwayat Transaksi Member"
        maxWidth="max-w-xl"
      >
        {loadingDetail ? (
          <div className="py-12 text-center text-slate-400">
            <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className="text-xs">Memuat detail member...</p>
          </div>
        ) : memberDetail ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Kode Member</span>
                <span className="font-mono font-bold text-blue-700 text-sm">{memberDetail.memberCode}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Status</span>
                <span className="font-bold">
                  {new Date(memberDetail.endDate) >= new Date() && memberDetail.status === "ACTIVE" ? (
                    <Badge variant="green">Aktif</Badge>
                  ) : (
                    <Badge variant="red">Expired</Badge>
                  )}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Nama Lengkap</span>
                <span className="font-bold text-slate-900">{memberDetail.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Nomor Telepon</span>
                <span className="font-bold text-slate-900">{memberDetail.phone || "-"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Paket Membership</span>
                <span className="font-semibold text-blue-700">{memberDetail.packageName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Masa Berlaku s/d</span>
                <span className="font-bold text-slate-900">{formatDateIndo(memberDetail.endDate)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Total Kunjungan</span>
                <span className="font-bold text-slate-900">{memberDetail.totalVisits || 0} kali</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Total Pengeluaran</span>
                <span className="font-black text-blue-700">{formatRupiah(memberDetail.totalSpend || 0)}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Riwayat Transaksi Terakhir
              </h4>
              {memberDetail.customer?.transactions && memberDetail.customer.transactions.length > 0 ? (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {memberDetail.customer.transactions.map((tx: any) => (
                    <div key={tx.id} className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between text-xs">
                      <div>
                        <div className="font-mono font-bold text-blue-700">{tx.invoiceNumber}</div>
                        <div className="text-[10px] text-slate-400">{formatDateIndo(tx.createdAt)} • {tx.branch}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-slate-900">{formatRupiah(tx.grandTotal)}</div>
                        {tx.discount > 0 && (
                          <div className="text-[10px] text-rose-600 font-semibold">Diskon {formatRupiah(tx.discount)}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic py-3 text-center bg-slate-50 rounded-lg">
                  Belum ada riwayat transaksi kasir untuk member ini.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
