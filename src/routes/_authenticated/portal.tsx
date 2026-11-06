import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { addDays, activeBookingFor, ADMIN_WA, canSkip, DAY_NAMES, flexibleBookingError, fmtDate, isLowQuota, isWeekday, PACKAGES, reservedPortions, rupiah, type Subscription } from "@/lib/catering";
import { bookFlexible, cancelFlexible, toggleSkip } from "@/lib/catering.functions";
import { portalQueryOptions } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/portal")({
  loader: ({ context }) => context.queryClient.ensureQueryData(portalQueryOptions),
  head: () => ({ meta: [
    { title: "Portal Saya — RantangKu" },
    { name: "description", content: "Cek sisa porsi, atur libur, dan pilih jadwal Kuota Fleksibel." },
    { property: "og:title", content: "Portal Saya — RantangKu" },
    { property: "og:description", content: "Atur jadwal makan dan pantau kuota Anda." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { name: "robots", content: "noindex" },
  ] }),
  component: Portal,
});

const STATUS_LABEL = { menunggu: "Menunggu pembayaran", aktif: "Aktif", selesai: "Selesai" } as const;

function Portal() {
  const { data } = useSuspenseQuery(portalQueryOptions);
  const queryClient = useQueryClient();
  const toggleSkipFn = useServerFn(toggleSkip);
  const bookFlexibleFn = useServerFn(bookFlexible);
  const cancelFlexibleFn = useServerFn(cancelFlexible);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const now = new Date();
  const days: string[] = [];
  for (let i = 1; days.length < 10; i++) { const d = addDays(now, i); if (isWeekday(d)) days.push(fmtDate(d)); }

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key); setError("");
    try { await action(); await queryClient.invalidateQueries({ queryKey: ["portal-data"] }); }
    catch (err) { setError(err instanceof Error ? err.message : "Perubahan gagal disimpan."); }
    finally { setBusy(""); }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm font-semibold text-primary">Portal pelanggan</p>
      <h1 className="mt-1 text-4xl font-bold">Halo, {data.profile.name.split(" ")[0]}!</h1>
      <p className="mt-2 text-muted-foreground">Semua langganan dan jadwal Anda tersimpan di akun ini.</p>
      <Link to="/pesan" className="btn-primary mt-6">Pesan paket baru</Link>
      {error && <p role="alert" className="mt-5 rounded-lg bg-warning-soft p-3 text-sm text-warning-foreground">{error}</p>}
      {data.subscriptions.length === 0 && <div className="card-box mt-6 text-center"><p>Anda belum memiliki langganan.</p><p className="mt-1 text-sm text-muted-foreground">Pilih paket untuk mulai makan siang tanpa ribet.</p></div>}

      {data.subscriptions.map((s) => <SubscriptionCard key={s.id} s={s} days={days} now={now} busy={busy}
        onSkip={(date) => run(`${s.id}-${date}`, () => toggleSkipFn({ data: { subscriptionId: s.id, date } }))}
        onBook={(date, portions) => run(`${s.id}-${date}`, () => bookFlexibleFn({ data: { subscriptionId: s.id, date, portions } }))}
        onCancel={(bookingId) => run(bookingId, () => cancelFlexibleFn({ data: { bookingId } }))}
      />)}
    </div>
  );
}

function SubscriptionCard({ s, days, now, busy, onSkip, onBook, onCancel }: {
  s: Subscription; days: string[]; now: Date; busy: string;
  onSkip: (date: string) => Promise<void>;
  onBook: (date: string, portions: number) => Promise<void>;
  onCancel: (bookingId: string) => Promise<void>;
}) {
  const reserved = reservedPortions(s);
  const pct = (s.remaining / s.total) * 100;
  return <div className="mt-6 space-y-4">
    <div className="card-box">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="text-sm text-muted-foreground">{s.code} · {PACKAGES[s.pkg].name}</p><h2 className="text-2xl font-bold">{s.pkg === "fleksibel" ? "Atur makan sesuai kebutuhan" : "Langganan harian Anda"}</h2></div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${s.status === "aktif" ? "bg-accent text-accent-foreground" : "bg-warning-soft text-warning-foreground"}`}>{STATUS_LABEL[s.status]}</span>
      </div>
      <div className="mt-5">
        <div className="flex items-baseline justify-between"><span className="text-sm">Kuota tersedia</span><span className="text-3xl font-bold">{s.remaining}<span className="text-base text-muted-foreground"> / {s.total}</span></span></div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted"><div className={`h-full ${isLowQuota(s) ? "bg-warning" : "bg-primary"}`} style={{ width: `${pct}%` }} /></div>
        {s.pkg === "fleksibel" && <p className="mt-2 text-sm text-muted-foreground">{reserved} porsi sudah dijadwalkan. Kuota berkurang saat dijadwalkan dan kembali jika dibatalkan sebelum batas waktu.</p>}
      </div>
      {isLowQuota(s) && <p className="mt-3 rounded-lg bg-warning-soft p-3 text-sm text-warning-foreground">Kuota tersedia hampir habis. <a className="font-semibold underline" target="_blank" rel="noreferrer" href={`https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(`Halo, saya ${s.name} (${s.code}) ingin perpanjang paket.`)}`}>Perpanjang via WA</a></p>}
      {s.status === "menunggu" && <p className="mt-3 rounded-lg bg-muted p-3 text-sm">Silakan transfer {rupiah(s.price)} ke BCA 1234567890 a.n. RantangKu lalu kirim bukti via WA.</p>}
    </div>

    {s.status === "aktif" && s.pkg === "fleksibel" && <div className="card-box">
      <h3 className="text-xl font-semibold">Pilih tanggal & jumlah porsi</h3>
      <p className="text-sm text-muted-foreground">Anda bisa memesan lebih dari 1 porsi per hari. Perubahan ditutup jam 20:00 sehari sebelumnya.</p>
      <ul className="mt-4 divide-y">{days.map((date) => <FlexibleDay key={date} s={s} date={date} now={now} busy={busy} onBook={onBook} onCancel={onCancel} />)}</ul>
    </div>}

    {s.status === "aktif" && s.pkg !== "fleksibel" && <div className="card-box">
      <h3 className="text-xl font-semibold">Jadwal antar & libur makan</h3>
      <p className="text-sm text-muted-foreground">Tekan “Libur” paling lambat jam 20:00 sehari sebelumnya. Porsi tidak berkurang.</p>
      <ul className="mt-4 divide-y">{days.slice(0, 7).map((date) => {
        const dt = new Date(date + "T00:00");
        const skipped = s.skips.includes(date);
        const allowed = canSkip(date, now);
        const before = date < s.start;
        return <li key={date} className="flex items-center justify-between gap-3 py-3">
          <div><p className="font-medium">{DAY_NAMES[dt.getDay()]}, {dt.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</p><p className="text-xs text-muted-foreground">{before ? "Belum mulai" : skipped ? "Libur — tidak diantar" : "Dijadwalkan diantar"}</p></div>
          {!before && <button disabled={!allowed || busy === `${s.id}-${date}`} onClick={() => onSkip(date)} className={skipped ? "btn-primary" : "btn-outline"}>{!allowed ? "Terkunci" : skipped ? "Batal libur" : "Libur"}</button>}
        </li>;
      })}</ul>
    </div>}

    {s.delivered.length > 0 && <div className="card-box"><h3 className="text-xl font-semibold">Riwayat pengiriman</h3><ul className="mt-2 text-sm">{[...s.delivered].reverse().map((d) => <li key={d.date} className="py-1">✅ {d.date} — {d.portions} porsi terkirim</li>)}</ul></div>}
  </div>;
}

function FlexibleDay({ s, date, now, busy, onBook, onCancel }: { s: Subscription; date: string; now: Date; busy: string; onBook: (date: string, portions: number) => Promise<void>; onCancel: (id: string) => Promise<void> }) {
  const [portions, setPortions] = useState(1);
  const booking = activeBookingFor(s, date);
  const delivered = s.delivered.find((d) => d.date === date);
  const allowed = canSkip(date, now) && date >= s.start;
  const validation = flexibleBookingError(s, date, portions, now);
  const dt = new Date(date + "T00:00");
  return <li className="flex flex-wrap items-center justify-between gap-3 py-3">
    <div><p className="font-medium">{DAY_NAMES[dt.getDay()]}, {dt.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</p><p className="text-xs text-muted-foreground">{delivered ? `${delivered.portions} porsi terkirim` : booking ? `${booking.portions} porsi terjadwal` : date < s.start ? "Belum mulai" : allowed ? "Belum ada jadwal" : "Sudah terkunci"}</p></div>
    {booking && <button disabled={!allowed || busy === booking.id} onClick={() => onCancel(booking.id)} className="btn-outline">{allowed ? "Batalkan" : "Terkunci"}</button>}
    {!booking && !delivered && allowed && <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`${s.id}-${date}`}>Jumlah porsi</label>
      <input id={`${s.id}-${date}`} type="number" min={1} max={s.remaining} value={portions} onChange={(e) => setPortions(Number(e.target.value))} className="input-field w-20" />
      <button disabled={Boolean(validation) || busy === `${s.id}-${date}`} title={validation ?? "Jadwalkan porsi"} onClick={() => onBook(date, portions)} className="btn-primary">Jadwalkan</button>
    </div>}
  </li>;
}
