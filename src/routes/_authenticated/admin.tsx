import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DAY_NAMES, fmtDate, isLowQuota, needsMeal, PACKAGES, AREAS, reservedPortions, rupiah, waInvoiceLink, type Menu, type Subscription } from "@/lib/catering";
import { deleteSubscription, getCurrentRole, markDelivered, updateMenu, verifySubscription } from "@/lib/catering.functions";
import { adminQueryOptions, menuQueryOptions } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => { if (await getCurrentRole() !== "admin") throw redirect({ to: "/portal" }); },
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(adminQueryOptions), context.queryClient.ensureQueryData(menuQueryOptions)]),
  head: () => ({ meta: [
    { title: "Dashboard Admin — RantangKu" },
    { name: "description", content: "Kelola pesanan, jadwal fleksibel, menu, kurir, dan tagihan." },
    { property: "og:title", content: "Dashboard Admin — RantangKu" },
    { property: "og:description", content: "Operasional dapur dan menu dalam satu layar khusus admin." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { name: "robots", content: "noindex" },
  ] }),
  component: Admin,
});

const TABS = ["Pesanan", "Dapur", "Kurir", "Menu", "Tagihan"] as const;
type KitchenRow = { s: Subscription; portions: number; done: boolean };

function Admin() {
  const { data: subs } = useSuspenseQuery(adminQueryOptions);
  const { data: menus } = useSuspenseQuery(menuQueryOptions);
  const queryClient = useQueryClient();
  const verifyFn = useServerFn(verifySubscription);
  const deleteFn = useServerFn(deleteSubscription);
  const deliveredFn = useServerFn(markDelivered);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Pesanan");
  const [date, setDate] = useState(fmtDate(new Date()));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const pending = subs.filter((s) => s.status === "menunggu");
  const skipped = subs.filter((s) => s.pkg !== "fleksibel" && s.status === "aktif" && s.skips.includes(date));
  const low = subs.filter(isLowQuota);
  const dow = new Date(date + "T00:00").getDay();
  const menu = menus.find((m) => m.day === dow);
  const kitchen: KitchenRow[] = subs.flatMap((s) => {
    if (s.pkg === "fleksibel") {
      const booking = s.bookings.find((b) => b.date === date && b.status !== "batal");
      return booking ? [{ s, portions: booking.portions, done: booking.status === "terkirim" }] : [];
    }
    const delivery = s.delivered.find((d) => d.date === date);
    return needsMeal(s, date) || delivery ? [{ s, portions: delivery?.portions ?? 1, done: Boolean(delivery) }] : [];
  });
  const totalPortions = kitchen.reduce((sum, row) => sum + row.portions, 0);

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key); setError("");
    try { await action(); await queryClient.invalidateQueries({ queryKey: ["admin-data"] }); }
    catch (err) { setError(err instanceof Error ? err.message : "Perubahan gagal disimpan."); }
    finally { setBusy(""); }
  }

  return <div className="mx-auto max-w-6xl px-4 py-10">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold text-primary">Area khusus admin</p><h1 className="mt-1 text-4xl font-bold">Dashboard Dapur</h1><p className="text-muted-foreground">Pesanan pelanggan, jadwal fleksibel, dan menu dikelola dari sini.</p></div><label className="text-sm">Tanggal operasional<input type="date" className="input-field mt-1" value={date} onChange={(e) => setDate(e.target.value)} /></label></div>
    {error && <p role="alert" className="mt-5 rounded-lg bg-warning-soft p-3 text-sm text-warning-foreground">{error}</p>}
    <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="Porsi dimasak" value={totalPortions} /><Stat label="Libur makan" value={skipped.length} /><Stat label="Pesanan baru" value={pending.length} warn={pending.length > 0} /><Stat label="Kuota kritis" value={low.length} warn={low.length > 0} /></div>
    <div className="mt-8 flex gap-1 overflow-x-auto rounded-full bg-muted p-1">{TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap ${tab === t ? "bg-card shadow" : "text-muted-foreground"}`}>{t}</button>)}</div>

    <div className="mt-6">
      {tab === "Pesanan" && <div className="space-y-3">{subs.length === 0 && <p className="text-muted-foreground">Belum ada pesanan.</p>}{subs.map((s) => <div key={s.id} className="card-box flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-semibold">{s.name} <span className="text-sm font-normal text-muted-foreground">· {s.code}</span></p><p className="text-sm text-muted-foreground">{PACKAGES[s.pkg].name} · {rupiah(s.price)} · {s.area} · mulai {s.start}</p>{s.notes && <p className="text-sm text-warning-foreground">⚠ {s.notes}</p>}</div>
        <div className="flex flex-wrap items-center gap-2"><span className="text-sm">Tersedia <b>{s.remaining}</b>/{s.total}{s.pkg === "fleksibel" && ` · ${reservedPortions(s)} terjadwal`}</span>{s.status === "menunggu" ? <button disabled={busy === s.id} className="btn-primary" onClick={() => run(s.id, () => verifyFn({ data: { id: s.id } }))}>Verifikasi & Aktifkan</button> : <span className="rounded-full bg-accent px-3 py-1 text-sm font-semibold capitalize text-accent-foreground">{s.status}</span>}<button className="btn-outline" onClick={() => { if (confirm(`Hapus pesanan ${s.name}?`)) void run(s.id, () => deleteFn({ data: { id: s.id } })); }}>Hapus</button></div>
      </div>)}</div>}

      {tab === "Dapur" && <div className="card-box"><h2 className="text-2xl font-bold">Checklist dapur</h2><p className="text-muted-foreground">Menu: <b className="text-foreground">{menu?.title ?? "Libur (akhir pekan)"}</b></p><p className="mt-4 font-display text-6xl font-bold text-primary">{totalPortions} <span className="text-2xl text-foreground">porsi</span></p><p className="mt-2 text-sm text-muted-foreground">Paket harian masuk otomatis; Kuota Fleksibel hanya masuk pada tanggal yang dipilih pelanggan.</p><h3 className="mt-6 font-semibold">Catatan khusus</h3><ul className="mt-2 space-y-1 text-sm">{kitchen.filter((r) => r.s.notes).map((r) => <li key={r.s.id}>⚠ {r.s.name}: {r.s.notes}</li>)}{kitchen.every((r) => !r.s.notes) && <li className="text-muted-foreground">Tidak ada.</li>}</ul><button className="btn-outline mt-6" onClick={() => window.print()}>🖨 Cetak rekap</button></div>}

      {tab === "Kurir" && <div className="grid gap-4 md:grid-cols-2">{AREAS.map((area) => { const list = kitchen.filter((r) => r.s.area === area); return <div key={area} className="card-box"><h2 className="text-xl font-bold">{area} <span className="text-sm font-normal text-muted-foreground">({list.reduce((n, r) => n + r.portions, 0)} porsi)</span></h2><ul className="mt-3 space-y-2">{list.length === 0 && <li className="text-sm text-muted-foreground">Tidak ada pengiriman.</li>}{list.map((row, i) => <CourierRow key={row.s.id} row={row} i={i} disabled={busy === row.s.id} onDone={() => run(row.s.id, () => deliveredFn({ data: { subscriptionId: row.s.id, date } }))} />)}</ul></div>; })}</div>}

      {tab === "Menu" && <MenuEditor menus={menus} />}

      {tab === "Tagihan" && <div className="space-y-3">{low.length === 0 && <p className="text-muted-foreground">Semua pelanggan masih punya cukup porsi.</p>}{low.map((s) => <div key={s.id} className="card-box flex flex-wrap items-center justify-between gap-3 border-warning bg-warning-soft"><div><p className="font-semibold">{s.name} · {s.phone}</p><p className="text-sm text-warning-foreground">Sisa {s.remaining} porsi tersedia — perlu perpanjangan</p></div><a className="btn-primary" target="_blank" rel="noreferrer" href={waInvoiceLink(s)}>Kirim Tagihan WA</a></div>)}</div>}
    </div>
  </div>;
}

function MenuEditor({ menus }: { menus: Menu[] }) {
  const [drafts, setDrafts] = useState(menus);
  const [busyDay, setBusyDay] = useState(0);
  const [savedDay, setSavedDay] = useState(0);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const updateFn = useServerFn(updateMenu);
  function change(day: number, key: keyof Menu, value: string | number | string[]) { setDrafts((all) => all.map((m) => m.day === day ? { ...m, [key]: value } : m)); }
  async function save(menu: Menu) {
    setBusyDay(menu.day); setError(""); setSavedDay(0);
    try { await updateFn({ data: menu }); await queryClient.invalidateQueries({ queryKey: ["weekly-menu"] }); setSavedDay(menu.day); }
    catch (err) { setError(err instanceof Error ? err.message : "Menu gagal disimpan."); }
    finally { setBusyDay(0); }
  }
  return <div><div className="mb-4"><h2 className="text-2xl font-bold">Editor menu Senin–Jumat</h2><p className="text-muted-foreground">Perubahan langsung tampil di halaman Menu dan Beranda pelanggan.</p></div>{error && <p role="alert" className="mb-4 rounded-lg bg-warning-soft p-3 text-sm text-warning-foreground">{error}</p>}<div className="space-y-4">{drafts.map((m) => <div key={m.day} className="card-box"><h3 className="text-xl font-bold text-primary">{DAY_NAMES[m.day]}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm">Nama menu<input className="input-field mt-1" value={m.title} onChange={(e) => change(m.day, "title", e.target.value)} /></label><label className="text-sm">Kategori<input className="input-field mt-1" value={m.category} onChange={(e) => change(m.day, "category", e.target.value)} /></label></div><label className="mt-3 block text-sm">Isi menu<textarea rows={2} className="input-field mt-1" value={m.desc} onChange={(e) => change(m.day, "desc", e.target.value)} /></label><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm">Kalori (kkal)<input type="number" min={0} className="input-field mt-1" value={m.kcal} onChange={(e) => change(m.day, "kcal", Number(e.target.value))} /></label><label className="text-sm">Alergen (pisahkan koma)<input className="input-field mt-1" value={m.allergens.join(", ")} onChange={(e) => change(m.day, "allergens", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} /></label></div><div className="mt-4 flex items-center gap-3"><button disabled={busyDay === m.day} className="btn-primary" onClick={() => save(m)}>{busyDay === m.day ? "Menyimpan…" : "Simpan menu"}</button>{savedDay === m.day && <span role="status" className="text-sm font-semibold text-primary">Tersimpan ✓</span>}</div></div>)}</div></div>;
}

function CourierRow({ row, i, disabled, onDone }: { row: KitchenRow; i: number; disabled: boolean; onDone: () => Promise<void> }) {
  return <li className="flex items-center justify-between gap-2 rounded-lg bg-muted p-3"><div className="text-sm"><p className="font-semibold">{i + 1}. {row.s.name} · {row.portions} porsi</p><p className="text-muted-foreground">{row.s.address}</p>{row.s.pkg === "fleksibel" && <p className="text-xs font-semibold text-primary">Jadwal fleksibel</p>}</div><button disabled={row.done || disabled} onClick={onDone} className={row.done ? "btn-outline" : "btn-primary"}>{row.done ? "✓ Terkirim" : "Tandai terkirim"}</button></li>;
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return <div className={`card-box ${warn ? "border-warning bg-warning-soft" : ""}`}><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-bold">{value}</p></div>;
}
