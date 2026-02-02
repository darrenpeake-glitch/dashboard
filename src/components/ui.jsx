import { ArrowUpRight } from "lucide-react";

export function Card({ title, right, children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl shadow-soft border border-slate-100 p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>{title ? <div className="text-sm font-semibold text-slate-800">{title}</div> : null}</div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function PillButton({ children, onClick, variant = "brand" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition active:scale-[0.99]";
  const styles =
    variant === "brand"
      ? "bg-emerald-700 text-white hover:bg-emerald-800"
      : "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50";
  return (
    <button onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

export function MiniLink() {
  return (
    <div className="h-9 w-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 grid place-items-center">
      <ArrowUpRight size={16} className="text-slate-700" />
    </div>
  );
}

export function Stat({ big, label, sub }) {
  return (
    <div className="flex flex-col">
      <div className="text-4xl font-extrabold tracking-tight">{big}</div>
      <div className="mt-1 text-sm font-semibold text-slate-800">{label}</div>
      {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
}
