"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, ShoppingCart, Clock, ArrowLeftRight, Building2, Crown, Shield } from "lucide-react";
import { formatDateIndo } from "@/lib/utils";
import { useUser } from "@/lib/user-context";

interface HeaderProps {
  onToggleMobile: () => void;
}

export function Header({ onToggleMobile }: HeaderProps) {
  const todayStr = formatDateIndo(new Date());
  const { user } = useUser();

  const getRoleBranchBadge = () => {
    if (!user) {
      return {
        roleName: "Admin",
        branchName: "Multi-Cabang",
        subTitle: "Sistem Manajemen Barbershop",
        color: "bg-blue-50 text-blue-700 border-blue-200",
        dotColor: "bg-blue-600",
      };
    }
    if (user.role === "OWNER") {
      return {
        roleName: "Owner",
        branchName: "Semua Cabang",
        subTitle: "Pusat Monitoring Seluruh Cabang",
        color: "bg-amber-50 text-amber-800 border-amber-200",
        dotColor: "bg-amber-600",
      };
    }
    if (user.role === "ADMIN_TELKOM") {
      return {
        roleName: "Admin Telkom",
        branchName: "Cabang Telkom",
        subTitle: "Operasional Cabang Telkom",
        color: "bg-blue-50 text-blue-700 border-blue-200",
        dotColor: "bg-blue-600",
      };
    }
    if (user.role === "ADMIN_SUTA") {
      return {
        roleName: "Admin Suta",
        branchName: "Cabang Suta",
        subTitle: "Operasional Cabang Suta",
        color: "bg-indigo-50 text-indigo-700 border-indigo-200",
        dotColor: "bg-indigo-600",
      };
    }
    return {
      roleName: "Administrator",
      branchName: "Multi-Cabang",
      subTitle: "Operasional Sistem",
      color: "bg-blue-50 text-blue-700 border-blue-200",
      dotColor: "bg-blue-600",
    };
  };

  const badge = getRoleBranchBadge();
  const isOwner = user?.role === "OWNER";

  return (
    <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 md:px-6 flex items-center justify-between gap-4 shadow-xs">
      {/* LEFT: Mobile Menu Button, Brand & Branch Identity */}
      <div className="flex items-center gap-2.5 md:gap-3 flex-shrink-0">
        <button
          onClick={onToggleMobile}
          className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition"
          aria-label="Buka Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="md:hidden flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white border border-blue-200 p-0.5 flex items-center justify-center">
            <Image
              src="/logo-ad-barbershop.png"
              alt="AD Barbershop"
              width={22}
              height={22}
              className="object-contain"
            />
          </div>
          <span className="font-extrabold text-xs text-slate-900 tracking-wider whitespace-nowrap">
            AD BARBERSHOP
          </span>
        </div>

        {/* Desktop Brand, Role & Branch Title */}
        <div className="hidden lg:flex flex-col whitespace-nowrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-wide text-slate-900 uppercase">
              AD BARBERSHOP — MANAGEMENT SYSTEM
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
            <span className="font-bold text-slate-800">{badge.roleName}</span>
            <span className="text-slate-300">•</span>
            <span>{badge.subTitle}</span>
          </div>
        </div>

        {/* Vertical Separator */}
        <div className="hidden lg:block h-6 w-px bg-slate-200 mx-1" />

        {/* Active Branch Pill */}
        <div className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold whitespace-nowrap ${badge.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`}></span>
          <span>{badge.branchName}</span>
        </div>
      </div>

      {/* RIGHT: Quick Action Buttons & Status */}
      <div className="flex items-center gap-2 md:gap-2.5 flex-shrink-0">
        {/* Desktop Date Display (only on 2xl / very wide screens to prevent crowding) */}
        <div className="hidden 2xl:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-blue-600" />
          <span>Hari ini: <strong className="text-slate-800 font-semibold">{todayStr}</strong></span>
        </div>

        {/* Operational Status Dot */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Sistem Aktif</span>
        </div>

        {/* Quick Transfer Produk Button (only on xl+ screens) */}
        <Link
          href="/transfer"
          className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition border border-slate-200 active:scale-95 whitespace-nowrap"
        >
          <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600" />
          <span>Transfer Produk</span>
        </Link>

        {/* Kasir / Monitoring Button */}
        {isOwner ? (
          <Link
            href="/laporan/cabang"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs transition shadow-sm shadow-blue-700/25 active:scale-95 whitespace-nowrap"
          >
            <Building2 className="w-4 h-4 text-white" />
            <span>Monitoring Cabang</span>
          </Link>
        ) : (
          <Link
            href="/kasir"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-sm shadow-blue-600/25 active:scale-95 whitespace-nowrap"
          >
            <ShoppingCart className="w-4 h-4 text-white" />
            <span>Buka Kasir</span>
          </Link>
        )}
      </div>
    </header>
  );
}
