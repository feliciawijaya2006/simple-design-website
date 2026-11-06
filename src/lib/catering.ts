export type PackageId = "5hari" | "20hari" | "fleksibel";
export const PACKAGES: Record<PackageId, { name: string; pax: number; price: number; desc: string }> = {
  "5hari": { name: "Paket 5 Hari", pax: 5, price: 125000, desc: "Coba dulu seminggu kerja" },
  "20hari": { name: "Paket 20 Hari", pax: 20, price: 460000, desc: "Makan siang sebulan penuh, paling hemat" },
  fleksibel: { name: "Kuota Fleksibel", pax: 10, price: 260000, desc: "10 porsi, pilih tanggal dan jumlah sesuai kebutuhan" },
};

export const AREAS = ["Kota Utara", "Kota Selatan", "Kota Timur", "Kota Barat"];
export const ADMIN_WA = "6281234567890";
export const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const LOW_QUOTA = 2;
export const SKIP_DEADLINE_HOUR = 20;

export type Menu = { day: number; title: string; desc: string; category: string; kcal: number; allergens: string[] };
export type Status = "menunggu" | "aktif" | "selesai";
export type BookingStatus = "terjadwal" | "terkirim" | "batal";
export type MealBooking = { id: string; date: string; portions: number; status: BookingStatus };
export type Delivery = { date: string; portions: number };
export type Profile = { id: string; name: string; phone: string; address: string; area: string; notes: string };
export type Subscription = {
  id: string;
  code: string;
  userId: string;
  name: string;
  phone: string;
  address: string;
  area: string;
  notes: string;
  pkg: PackageId;
  total: number;
  remaining: number;
  price: number;
  status: Status;
  paid: boolean;
  start: string;
  skips: string[];
  delivered: Delivery[];
  bookings: MealBooking[];
  createdAt: string;
};

export const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const isWeekday = (d: Date) => d.getDay() >= 1 && d.getDay() <= 5;
export const isLowQuota = (s: Subscription) => s.status === "aktif" && s.remaining <= LOW_QUOTA;
export const rupiah = (n: number) => "Rp" + n.toLocaleString("id-ID");
export const normPhone = (p: string) => p.replace(/\D/g, "").replace(/^0/, "62");

/** Perubahan jadwal hanya boleh sebelum 20:00 pada H-1. */
export function canSkip(target: string, now: Date): boolean {
  const [y = 0, m = 1, d = 1] = target.split("-").map(Number);
  const deadline = new Date(y, m - 1, d - 1, SKIP_DEADLINE_HOUR, 0, 0);
  return now < deadline;
}

/** Paket harian tetap diantar kecuali libur; paket fleksibel hanya memakai jadwal porsi. */
export const needsMeal = (s: Subscription, date: string) =>
  s.pkg !== "fleksibel" && s.status === "aktif" && s.remaining > 0 && s.start <= date && !s.skips.includes(date) && !s.delivered.some((d) => d.date === date);

export const activeBookingFor = (s: Subscription, date: string) =>
  s.bookings.find((b) => b.date === date && b.status === "terjadwal");

/** Validasi yang sama juga diterapkan oleh database sebelum kuota dikurangi. */
export function flexibleBookingError(s: Subscription, date: string, portions: number, now: Date): string | null {
  if (s.pkg !== "fleksibel") return "Jadwal porsi hanya untuk Kuota Fleksibel.";
  if (s.status !== "aktif") return "Paket belum aktif.";
  if (!Number.isInteger(portions) || portions < 1) return "Jumlah porsi minimal 1.";
  if (portions > s.remaining) return `Sisa kuota hanya ${s.remaining} porsi.`;
  if (!isWeekday(new Date(date + "T00:00"))) return "Pengiriman hanya Senin–Jumat.";
  if (date < s.start) return "Tanggal sebelum langganan dimulai.";
  if (!canSkip(date, now)) return "Batas pemesanan jam 20:00 H-1 sudah lewat.";
  if (activeBookingFor(s, date)) return "Tanggal ini sudah memiliki jadwal.";
  return null;
}

export function reservedPortions(s: Subscription): number {
  return s.bookings.filter((b) => b.status === "terjadwal").reduce((sum, b) => sum + b.portions, 0);
}

export function waInvoiceLink(s: Subscription) {
  const p = PACKAGES[s.pkg];
  const msg = `Halo ${s.name}, sisa porsi RantangKu Anda tinggal ${s.remaining}. Yuk perpanjang ${p.name} (${rupiah(p.price)}).\nTransfer BCA 1234567890 a.n. RantangKu atau QRIS. Kirim bukti bayar ke nomor ini ya. Terima kasih!`;
  return `https://wa.me/${normPhone(s.phone)}?text=${encodeURIComponent(msg)}`;
}
