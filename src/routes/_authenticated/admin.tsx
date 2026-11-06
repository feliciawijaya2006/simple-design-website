import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useSubs, updateSub, setSubs, markDelivered, needsMeal, isLowQuota, waInvoiceLink, PACKAGES, AREAS, WEEK_MENU, fmtDate, rupiah, type Subscription } from "@/lib/catering";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Dashboard Admin — RantangKu" },
      { name: "description", content: "Kelola pesanan, rekap porsi dapur, daftar kurir, dan tagihan WhatsApp." },
      { property: "og:title", content: "Dashboard Admin — RantangKu" },
      { property: "og:description", content: "Operasional dapur dan kurir dalam satu layar." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

const TABS = ["Pesanan", "Dapur", "Kurir", "Tagihan"] as const;

function Admin() {
  const subs = useSubs();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Pesanan");
  const [date, setDate] = useState(fmtDate(new Date()));
  const pending = subs.filter((s) => s.status === "menunggu");
  const todayList = subs.filter((s) => needsMeal(s, date) || s.delivered.includes(date));
  const skipped = subs.filter((s) => s.status === "aktif" && s.skips.includes(date));
  const low = subs.filter(isLowQuota);
  const dow = new Date(date + "T00:00").getDay();
  const menu = WEEK_MENU.find((m) => m.day === dow);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-bold">Dashboard Dapur</h1>
          <p className="text-muted-foreground">Mode demo — data tersimpan di perangkat ini.</p>
        </div>
        <label className="text-sm">Tanggal operasional<input type="date" className="input-field mt-1" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Porsi dimasak" value={todayList.length} />
        <Stat label="Libur makan" value={skipped.length} />
        <Stat label="Pesanan baru" value={pending.length} warn={pending.length > 0} />
        <Stat label="Kuota kritis" value={low.length} warn={low.length > 0} />
      </div>

      <div className="mt-8 flex gap-1 overflow-x-auto rounded-full bg-muted p-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${tab === t ? "bg-card shadow" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "Pesanan" && (
          <div className="space-y-3">
            {subs.length === 0 && <p className="text-muted-foreground">Belum ada pesanan.</p>}
            {subs.map((s) => (
              <div key={s.id} className="card-box flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{s.name} <span className="text-sm font-normal text-muted-foreground">· {s.id}</span></p>
                  <p className="text-sm text-muted-foreground">{PACKAGES[s.pkg].name} · {rupiah(s.price)} · {s.area} · mulai {s.start}</p>
                  {s.notes && <p className="text-sm text-warning-foreground">⚠ {s.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Sisa <b>{s.remaining}</b>/{s.total}</span>
                  {s.status === "menunggu" ? (
                    <button className="btn-primary" onClick={() => updateSub(s.id, (x) => ({ ...x, status: "aktif", paid: true }))}>Verifikasi & Aktifkan</button>
                  ) : (
                    <span className="rounded-full bg-accent px-3 py-1 text-sm font-semibold capitalize text-accent-foreground">{s.status}</span>
                  )}
                  <button className="btn-outline" onClick={() => confirm(`Hapus pesanan ${s.name}?`) && setSubs((all) => all.filter((x) => x.id !== s.id))}>Hapus</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "Dapur" && (
          <div className="card-box">
            <h2 className="text-2xl font-bold">Checklist dapur</h2>
            <p className="text-muted-foreground">Menu: <b className="text-foreground">{menu?.title ?? "Libur (akhir pekan)"}</b></p>
            <p className="mt-4 font-display text-6xl font-bold text-primary">{todayList.length} <span className="text-2xl text-foreground">porsi</span></p>
            <h3 className="mt-6 font-semibold">Catatan khusus</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {todayList.filter((s) => s.notes).map((s) => <li key={s.id}>⚠ {s.name}: {s.notes}</li>)}
              {todayList.every((s) => !s.notes) && <li className="text-muted-foreground">Tidak ada.</li>}
            </ul>
            <button className="btn-outline mt-6" onClick={() => window.print()}>🖨 Cetak rekap</button>
          </div>
        )}

        {tab === "Kurir" && (
          <div className="grid gap-4 md:grid-cols-2">
            {AREAS.map((a) => {
              const list = todayList.filter((s) => s.area === a);
              return (
                <div key={a} className="card-box">
                  <h2 className="text-xl font-bold">{a} <span className="text-sm font-normal text-muted-foreground">({list.length})</span></h2>
                  <ul className="mt-3 space-y-2">
                    {list.length === 0 && <li className="text-sm text-muted-foreground">Tidak ada pengiriman.</li>}
                    {list.map((s, i) => <CourierRow key={s.id} s={s} i={i} date={date} />)}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {tab === "Tagihan" && (
          <div className="space-y-3">
            {low.length === 0 && <p className="text-muted-foreground">Semua pelanggan masih punya cukup porsi.</p>}
            {low.map((s) => (
              <div key={s.id} className="card-box flex flex-wrap items-center justify-between gap-3 border-warning bg-warning-soft">
                <div>
                  <p className="font-semibold">{s.name} · {s.phone}</p>
                  <p className="text-sm text-warning-foreground">Sisa {s.remaining} porsi — perlu perpanjangan</p>
                </div>
                <a className="btn-primary" target="_blank" rel="noreferrer" href={waInvoiceLink(s)}>Kirim Tagihan WA</a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CourierRow({ s, i, date }: { s: Subscription; i: number; date: string }) {
  const done = s.delivered.includes(date);
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg bg-muted p-3">
      <div className="text-sm">
        <p className="font-semibold">{i + 1}. {s.name}</p>
        <p className="text-muted-foreground">{s.address}</p>
      </div>
      <button disabled={done} onClick={() => updateSub(s.id, (x) => markDelivered(x, date))} className={done ? "btn-outline" : "btn-primary"}>{done ? "✓ Terkirim" : "Tandai terkirim"}</button>
    </li>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`card-box ${warn ? "border-warning bg-warning-soft" : ""}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}
