import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useSubs, updateSub, toggleSkip, canSkip, isLowQuota, PACKAGES, DAY_NAMES, ADMIN_WA, addDays, fmtDate, isWeekday, normPhone, rupiah } from "@/lib/catering";

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "Portal Saya — RantangKu" },
      { name: "description", content: "Cek sisa porsi, jadwal antar, dan ajukan libur makan sendiri." },
      { property: "og:title", content: "Portal Saya — RantangKu" },
      { property: "og:description", content: "Cek sisa porsi dan atur libur makan Anda." },
    ],
  }),
  component: Portal,
});

const STATUS_LABEL = { menunggu: "Menunggu pembayaran", aktif: "Aktif", selesai: "Selesai" } as const;

function Portal() {
  const subs = useSubs();
  const [phone, setPhone] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const mine = query ? subs.filter((s) => normPhone(s.phone) === normPhone(query)) : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-4xl font-bold">Portal Saya</h1>
      <p className="mt-2 text-muted-foreground">Masukkan nomor WhatsApp yang dipakai saat memesan.</p>
      <form onSubmit={(e) => { e.preventDefault(); setQuery(phone); }} className="mt-6 flex gap-2">
        <input className="input-field" inputMode="tel" placeholder="08xxxxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button className="btn-primary shrink-0">Cek</button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">Coba contoh: 081211112222</p>

      {query && mine.length === 0 && (
        <div className="card-box mt-6 text-center">
          <p>Belum ada langganan dengan nomor ini.</p>
          <Link to="/pesan" className="btn-primary mt-4">Pesan sekarang</Link>
        </div>
      )}

      {mine.map((s) => {
        const now = new Date();
        const days: string[] = [];
        for (let i = 1; days.length < 7; i++) { const d = addDays(now, i); if (isWeekday(d)) days.push(fmtDate(d)); }
        const pct = (s.remaining / s.total) * 100;
        return (
          <div key={s.id} className="mt-6 space-y-4">
            <div className="card-box">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-muted-foreground">{s.id} · {PACKAGES[s.pkg].name}</p>
                  <h2 className="text-2xl font-bold">Halo, {s.name.split(" ")[0]}!</h2>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${s.status === "aktif" ? "bg-accent text-accent-foreground" : "bg-warning-soft text-warning-foreground"}`}>{STATUS_LABEL[s.status]}</span>
              </div>
              <div className="mt-5">
                <div className="flex items-baseline justify-between"><span className="text-sm">Sisa porsi</span><span className="text-3xl font-bold">{s.remaining}<span className="text-base text-muted-foreground"> / {s.total}</span></span></div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted"><div className={`h-full ${isLowQuota(s) ? "bg-warning" : "bg-primary"}`} style={{ width: `${pct}%` }} /></div>
              </div>
              {isLowQuota(s) && <p className="mt-3 rounded-lg bg-warning-soft p-3 text-sm text-warning-foreground">Porsi Anda hampir habis. <a className="font-semibold underline" target="_blank" rel="noreferrer" href={`https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(`Halo, saya ${s.name} (${s.id}) ingin perpanjang paket.`)}`}>Perpanjang via WA</a></p>}
              {s.status === "menunggu" && <p className="mt-3 rounded-lg bg-muted p-3 text-sm">Silakan transfer {rupiah(s.price)} ke BCA 1234567890 a.n. RantangKu lalu kirim bukti via WA.</p>}
            </div>

            {s.status === "aktif" && (
              <div className="card-box">
                <h3 className="text-xl font-semibold">Jadwal antar & libur makan</h3>
                <p className="text-sm text-muted-foreground">Tekan "Libur" paling lambat jam 20:00 sehari sebelumnya. Porsi tidak berkurang.</p>
                <ul className="mt-4 divide-y">
                  {days.map((d) => {
                    const dt = new Date(d + "T00:00");
                    const skipped = s.skips.includes(d);
                    const allowed = canSkip(d, now);
                    const before = d < s.start;
                    return (
                      <li key={d} className="flex items-center justify-between py-3">
                        <div>
                          <p className="font-medium">{DAY_NAMES[dt.getDay()]}, {dt.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</p>
                          <p className="text-xs text-muted-foreground">{before ? "Belum mulai" : skipped ? "Libur — tidak diantar" : "Dijadwalkan diantar"}</p>
                        </div>
                        {!before && (
                          <button disabled={!allowed} onClick={() => updateSub(s.id, (x) => toggleSkip(x, d))}
                            className={skipped ? "btn-primary" : "btn-outline"}>
                            {!allowed ? "Terkunci" : skipped ? "Batal libur" : "Libur"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {s.delivered.length > 0 && (
              <div className="card-box">
                <h3 className="text-xl font-semibold">Riwayat pengiriman</h3>
                <ul className="mt-2 text-sm">{[...s.delivered].reverse().map((d) => <li key={d} className="py-1">✅ {d} — Terkirim</li>)}</ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
