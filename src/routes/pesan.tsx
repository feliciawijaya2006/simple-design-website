import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AREAS, PACKAGES, ADMIN_WA, rupiah, setSubs, fmtDate, addDays, type PackageId, type Subscription } from "@/lib/catering";

export const Route = createFileRoute("/pesan")({
  validateSearch: (s: Record<string, unknown>): { paket?: PackageId } =>
    typeof s["paket"] === "string" && s["paket"] in PACKAGES ? { paket: s["paket"] as PackageId } : {},
  head: () => ({
    meta: [
      { title: "Pesan Langganan — RantangKu" },
      { name: "description", content: "Isi formulir singkat untuk berlangganan katering rantangan RantangKu." },
      { property: "og:title", content: "Pesan Langganan — RantangKu" },
      { property: "og:description", content: "Pilih paket, tanggal mulai, dan catatan alergi Anda." },
    ],
  }),
  component: OrderPage,
});

function OrderPage() {
  const search = Route.useSearch();
  const [pkg, setPkg] = useState<PackageId>(search.paket ?? "20hari");
  const [form, setForm] = useState({ name: "", phone: "", address: "", area: AREAS[0] ?? "", notes: "", start: fmtDate(addDays(new Date(), 1)) });
  const [done, setDone] = useState<Subscription | null>(null);
  const p = PACKAGES[pkg];
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const sub: Subscription = {
      id: "RK-" + Math.floor(1000 + Math.random() * 9000), ...form, pkg, total: p.pax, remaining: p.pax, price: p.price,
      status: "menunggu", paid: false, skips: [], delivered: [], createdAt: fmtDate(new Date()),
    };
    setSubs((all) => [sub, ...all]);
    setDone(sub);
  }

  if (done) {
    const msg = `Halo RantangKu, saya ${done.name} sudah memesan ${p.name} (kode ${done.id}). Berikut bukti transfer saya.`;
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="card-box text-center">
          <div className="text-5xl">🎉</div>
          <h1 className="mt-3 text-3xl font-bold">Pesanan diterima!</h1>
          <p className="mt-2 text-muted-foreground">Kode pesanan: <b className="text-foreground">{done.id}</b></p>
          <div className="mt-6 rounded-xl bg-muted p-4 text-left text-sm">
            <p className="font-semibold">Cara bayar — {rupiah(done.price)}</p>
            <p className="mt-1">Transfer BCA <b>1234567890</b> a.n. RantangKu, atau scan QRIS saat konfirmasi WA.</p>
            <p className="mt-1">Paket aktif setelah admin memverifikasi pembayaran.</p>
          </div>
          <div className="mt-6 flex flex-col gap-2">
            <a className="btn-primary" target="_blank" rel="noreferrer" href={`https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(msg)}`}>Kirim bukti bayar via WA</a>
            <Link to="/portal" className="btn-outline">Buka Portal Saya</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-4xl font-bold">Pesan langganan</h1>
      <p className="mt-2 text-muted-foreground">Cukup 1 menit. Pembayaran dilakukan setelah pesanan dikirim.</p>
      <form onSubmit={submit} className="mt-8 space-y-6">
        <div>
          <p className="mb-2 font-semibold">1. Pilih paket</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(PACKAGES) as PackageId[]).map((id) => (
              <button type="button" key={id} onClick={() => setPkg(id)} className={`card-box text-left ${pkg === id ? "border-primary ring-2 ring-primary" : ""}`}>
                <p className="font-semibold">{PACKAGES[id].name}</p>
                <p className="text-lg font-bold">{rupiah(PACKAGES[id].price)}</p>
                <p className="text-xs text-muted-foreground">{PACKAGES[id].pax} porsi</p>
              </button>
            ))}
          </div>
        </div>
        <div className="card-box space-y-4">
          <p className="font-semibold">2. Data pengiriman</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">Nama lengkap<input required className="input-field mt-1" value={form.name} onChange={set("name")} /></label>
            <label className="text-sm">No. WhatsApp<input required inputMode="tel" placeholder="08xxxxxxxxxx" className="input-field mt-1" value={form.phone} onChange={set("phone")} /></label>
          </div>
          <label className="block text-sm">Alamat lengkap<input required className="input-field mt-1" value={form.address} onChange={set("address")} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">Wilayah<select className="input-field mt-1" value={form.area} onChange={set("area")}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select></label>
            <label className="text-sm">Mulai antar<input type="date" required min={fmtDate(addDays(new Date(), 1))} className="input-field mt-1" value={form.start} onChange={set("start")} /></label>
          </div>
          <label className="block text-sm">Catatan alergi / pantangan (opsional)<textarea rows={2} placeholder="contoh: alergi udang, tidak pedas" className="input-field mt-1" value={form.notes} onChange={set("notes")} /></label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-primary-soft p-5">
          <div><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{rupiah(p.price)}</p></div>
          <button className="btn-primary">Kirim Pesanan</button>
        </div>
      </form>
    </div>
  );
}
