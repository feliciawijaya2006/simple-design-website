import { useEffect, useSyncExternalStore } from "react";

export type PackageId = "5hari" | "20hari" | "fleksibel";
export const PACKAGES: Record<PackageId, { name: string; pax: number; price: number; desc: string }> = {
  "5hari": { name: "Paket 5 Hari", pax: 5, price: 125000, desc: "Coba dulu seminggu kerja" },
  "20hari": { name: "Paket 20 Hari", pax: 20, price: 460000, desc: "Makan siang sebulan penuh, paling hemat" },
  fleksibel: { name: "Kuota Fleksibel", pax: 10, price: 260000, desc: "10 porsi, pakai kapan saja" },
};

export const AREAS = ["Kota Utara", "Kota Selatan", "Kota Timur", "Kota Barat"];
export const ADMIN_WA = "6281234567890";

export type Menu = { day: number; title: string; desc: string; category: string; kcal: number; allergens: string[] };
export const WEEK_MENU: Menu[] = [
  { day: 1, title: "Ayam Bakar Madu", desc: "Nasi, ayam bakar madu, tumis buncis, tempe goreng, sambal", category: "Rumahan", kcal: 640, allergens: ["Kedelai"] },
  { day: 2, title: "Ikan Kembung Balado", desc: "Nasi, kembung balado, sayur asem, perkedel kentang", category: "Rumahan", kcal: 590, allergens: ["Ikan"] },
  { day: 3, title: "Rendang Daging", desc: "Nasi, rendang sapi, daun singkong, telur balado", category: "Spesial", kcal: 720, allergens: ["Telur"] },
  { day: 4, title: "Chicken Teriyaki Sehat", desc: "Nasi merah, ayam teriyaki, brokoli kukus, wortel", category: "Sehat", kcal: 520, allergens: ["Kedelai", "Wijen"] },
  { day: 5, title: "Soto Ayam Lamongan", desc: "Nasi, soto ayam, koya, telur rebus, kerupuk", category: "Rumahan", kcal: 610, allergens: ["Telur", "Udang"] },
];
export const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export type Status = "menunggu" | "aktif" | "selesai";
export type Subscription = {
  id: string; name: string; phone: string; address: string; area: string; notes: string;
  pkg: PackageId; total: number; remaining: number; price: number;
  status: Status; paid: boolean; start: string; skips: string[]; delivered: string[]; createdAt: string;
};

// ---------- pure business rules ----------
export const LOW_QUOTA = 2;
export const SKIP_DEADLINE_HOUR = 20;
export const isLowQuota = (s: Subscription) => s.status === "aktif" && s.remaining <= LOW_QUOTA;
export const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const isWeekday = (d: Date) => d.getDay() >= 1 && d.getDay() <= 5;

/** Skip for a date is allowed only before 20:00 the day before (H-1). */
export function canSkip(target: string, now: Date): boolean {
  const [y = 0, m = 1, d = 1] = target.split("-").map(Number);
  const deadline = new Date(y, m - 1, d - 1, SKIP_DEADLINE_HOUR, 0, 0);
  return now < deadline;
}
/** Skipping never reduces remaining quota. */
export function toggleSkip(s: Subscription, date: string): Subscription {
  const skips = s.skips.includes(date) ? s.skips.filter((x) => x !== date) : [...s.skips, date];
  return { ...s, skips };
}
/** Delivery deducts one portion. */
export function markDelivered(s: Subscription, date: string): Subscription {
  if (s.delivered.includes(date) || s.remaining <= 0 || s.skips.includes(date)) return s;
  const remaining = s.remaining - 1;
  return { ...s, remaining, delivered: [...s.delivered, date], status: remaining === 0 ? "selesai" : s.status };
}
export const needsMeal = (s: Subscription, date: string) =>
  s.status === "aktif" && s.remaining > 0 && s.start <= date && !s.skips.includes(date) && !s.delivered.includes(date);

export const rupiah = (n: number) => "Rp" + n.toLocaleString("id-ID");
export const normPhone = (p: string) => p.replace(/\D/g, "").replace(/^0/, "62");

export function waInvoiceLink(s: Subscription) {
  const p = PACKAGES[s.pkg];
  const msg = `Halo ${s.name}, sisa porsi RantangKu Anda tinggal ${s.remaining}. Yuk perpanjang ${p.name} (${rupiah(p.price)}).\nTransfer BCA 1234567890 a.n. RantangKu atau QRIS. Kirim bukti bayar ke nomor ini ya. Terima kasih!`;
  return `https://wa.me/${normPhone(s.phone)}?text=${encodeURIComponent(msg)}`;
}

// ---------- store ----------
const KEY = "rantangku-v1";
const today = fmtDate(new Date());
const SEED: Subscription[] = [
  { id: "RK-1001", name: "Budi Santoso", phone: "081211112222", address: "Jl. Melati 12", area: "Kota Utara", notes: "Tidak pedas", pkg: "20hari", total: 20, remaining: 14, price: 460000, status: "aktif", paid: true, start: today, skips: [], delivered: [], createdAt: today },
  { id: "RK-1002", name: "Sari Wulandari", phone: "081233334444", address: "Perum Asri B3", area: "Kota Selatan", notes: "Alergi udang", pkg: "5hari", total: 5, remaining: 2, price: 125000, status: "aktif", paid: true, start: today, skips: [], delivered: [], createdAt: today },
  { id: "RK-1003", name: "Andi Pratama", phone: "081255556666", address: "Jl. Kenanga 5", area: "Kota Utara", notes: "", pkg: "fleksibel", total: 10, remaining: 10, price: 260000, status: "menunggu", paid: false, start: today, skips: [], delivered: [], createdAt: today },
];

let state: Subscription[] = SEED;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => { if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(state)); listeners.forEach((l) => l()); };

export function setSubs(fn: (s: Subscription[]) => Subscription[]) { state = fn(state); emit(); }
export function updateSub(id: string, fn: (s: Subscription) => Subscription) { setSubs((all) => all.map((s) => (s.id === id ? fn(s) : s))); }

export function useSubs() {
  useEffect(() => {
    if (loaded) return;
    loaded = true;
    try { const raw = localStorage.getItem(KEY); if (raw) { state = JSON.parse(raw); listeners.forEach((l) => l()); } } catch { /* ignore */ }
  }, []);
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
    () => SEED,
  );
}
