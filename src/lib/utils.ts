import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number): string {
  return BRL.format(value || 0);
}

export function formatCompact(value: number): string {
  const v = Math.abs(value || 0);
  if (v >= 1_000_000_000) return `R$ ${(value / 1_000_000_000).toFixed(1).replace(".", ",")} bi`;
  if (v >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (v >= 1_000) return `R$ ${(value / 1_000).toFixed(0)} mil`;
  return formatCurrency(value);
}

export function formatCompactShort(value: number): string {
  const v = Math.abs(value || 0);
  const sign = value < 0 ? "-" : "";
  if (v >= 1_000_000) return `${sign}${(v / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (v >= 1_000) return `${sign}${(v / 1_000).toFixed(0)} mil`;
  return `${sign}${v}`;
}

export function formatPercent(ratio: number, digits = 1): string {
  if (!isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits).replace(".", ",")}%`;
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function monthLabel(iso: string): string {
  if (!iso) return "—";
  const [y, m] = iso.split("-");
  const meses = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  const mi = parseInt(m, 10) - 1;
  if (mi < 0 || mi > 11) return iso;
  return `${meses[mi]}/${y.slice(2)}`;
}

export function monthKeyOf(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 7); // YYYY-MM
}
