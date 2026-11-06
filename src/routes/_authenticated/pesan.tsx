import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AREAS, PACKAGES, ADMIN_WA, rupiah, fmtDate, addDays, type PackageId } from "@/lib/catering";
import { createOrder } from "@/lib/catering.functions";
import { portalQueryOptions } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/pesan")({
  validateSearch: (s: Record<string, unknown>): { paket?: PackageId } => typeof s["paket"] === "string" && s["paket"] in PACKAGES ? { paket: s["paket"] as PackageId } : {},
  loader: ({ context }) => context.queryClient.ensureQueryData(portalQueryOptions),
  head: () => ({ meta: [
    { title: "Pesan Langganan — RantangKu" },
    { name: "description", content: "Pesan katering dengan data pengiriman dari profil Anda." },
    { property: "og:title", content: "Pesan Langganan — RantangKu" },
    { property: "og:description", content: "Pilih paket dan tanggal mulai makan Anda." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { name: "robots", content: "noindex" },
  ] }),
  component: OrderPage,
});

function OrderPage() {
  const search = Route.useSearch();
  const { data } = useSuspenseQuery(portalQueryOptions);
  const queryClient = useQueryClient();
  const submitOrder = useServerFn(createOrder);
  const [pkg, setPkg] = useState<PackageId>(search.paket ?? "20hari");
  const [form, setForm] = useState({ name: data.profile.name, phone: data.profile.phone, address: data.profile.address, area: data.profile.area || AREAS[0] || "", notes: data.profile.notes, start: fmtDate(addDays(new Date(), 1)) });
  const [done, setDone] = useState<{ code: string; price: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const p = PACKAGES[pkg];
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const order = await submitOrder({ data: { pkg, ...form } });
      await queryClient.invalidateQueries({ queryKey: ["portal-data"] });
      setDone({ code: order.order_code, price: p.price });
    } catch (err) { setError(err instanceof Error ? err.message : "Pesanan gagal dikirim."); }
    finally { setBusy(false); }
  }

  if (done) {
    const msg = `Halo RantangKu, saya ${form.name} sudah memesan ${p.name} (kode ${done.code}). Berikut bukti transfer saya.`;
    return <div className="mx-auto max-w-xl px-4 py-12"><div className="card-box text-center">
      <div className="text-5xl">🎉</div><h1 className="mt-3 text-3xl font-bold">Pesanan diterima!</h1><p className="mt-2 text-muted-foreground">Kode pesanan: <b className="text-foreground">{done.code}</b></p>
      <div className="mt-6 rounded-xl bg-muted p-4 text-left text-sm"><p className="font-semibold">Cara bayar — {rupiah(done.price)}</p><p className="mt-1">Transfer BCA <b>1234567890</b> a.n. RantangKu, atau scan QRIS saat konfirmasi WA.</p><p className="mt-1">Paket aktif setelah admin memverifikasi pembayaran.</p></div>
      <div className="mt-6 flex flex-col gap-2"><a className="btn-primary" target="_blank" rel="noreferrer" href={`https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(msg)}`}>Kirim bukti bayar via WA</a><Link to="/portal" className="btn-outline">Buka Portal Saya</Link></div>
    </div></div>;
  }

  return <div className="mx-auto max-w-3xl px-4 py-10">
    <p className="text-sm font-semibold text-primary">Portal pelanggan</p><h1 className="mt-1 text-4xl font-bold">Pesan langganan</h1><p className="mt-2 text-muted-foreground">Data profil Anda dipakai untuk pengiriman dan bisa disesuaikan di bawah.</p>
    <form onSubmit={submit} className="mt-8 space-y-6">
      <div><p className="mb-2 font-semibold">1. Pilih paket</p><div className="grid gap-3 sm:grid-cols-3">{(Object.keys(PACKAGES) as PackageId[]).map((id) => <button type="button" key={id} onClick={() => setPkg(id)} className={`card-box text-left ${pkg === id ? "border-primary ring-2 ring-primary" : ""}`}><p className="font-semibold">{PACKAGES[id].name}</p><p className="text-lg font-bold">{rupiah(PACKAGES[id].price)}</p><p className="text-xs text-muted-foreground">{PACKAGES[id].pax} porsi</p>{id === "fleksibel" && <p className="mt-1 text-xs text-muted-foreground">Tanggal & jumlah diatur setelah aktif</p>}</button>)}</div></div>
      <div className="card-box space-y-4"><p className="font-semibold">2. Data pengiriman</p>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Nama lengkap<input required className="input-field mt-1" value={form.name} onChange={set("name")} /></label><label className="text-sm">No. WhatsApp<input required inputMode="tel" className="input-field mt-1" value={form.phone} onChange={set("phone")} /></label></div>
        <label className="block text-sm">Alamat lengkap<textarea required rows={2} className="input-field mt-1" value={form.address} onChange={set("address")} /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Wilayah<select className="input-field mt-1" value={form.area} onChange={set("area")}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select></label><label className="text-sm">Mulai antar<input type="date" required min={fmtDate(addDays(new Date(), 1))} className="input-field mt-1" value={form.start} onChange={set("start")} /></label></div>
        <label className="block text-sm">Catatan alergi / pantangan (opsional)<textarea rows={2} className="input-field mt-1" value={form.notes} onChange={set("notes")} /></label>
      </div>
      {error && <p role="alert" className="rounded-lg bg-warning-soft p-3 text-sm text-warning-foreground">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-primary-soft p-5"><div><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{rupiah(p.price)}</p></div><button disabled={busy} className="btn-primary">{busy ? "Mengirim…" : "Kirim Pesanan"}</button></div>
    </form>
  </div>;
}
