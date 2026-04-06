import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function getHealthColor(score: number): string {
  if (score >= 75) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

export function getHealthBg(score: number): string {
  if (score >= 75) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (score >= 50) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-red-500/20 text-red-400 border-red-500/30";
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    inactive: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    trial: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    contacted: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    converted: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    lost: "bg-red-500/20 text-red-400 border-red-500/30",
    todo: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    in_progress: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    done: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    paid: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    overdue: "bg-red-500/20 text-red-400 border-red-500/30",
    draft: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    published: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    in_review: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  };
  return map[status] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30";
}

export function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}
