import { createFileRoute, Link } from "@tanstack/react-router";
import hero from "@/assets/hero-rantang.jpg";
import { PACKAGES, WEEK_MENU, DAY_NAMES, rupiah, type PackageId } from "@/lib/catering";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RantangKu — Katering Rantangan Harian & Langganan" },
      { name: "description", content: "Makan siang rumahan diantar tiap hari. Lihat menu mingguan, pesan paket, dan atur libur makan sendiri." },
      { property: "og:title", content: "RantangKu — Katering Rantangan Harian" },
      { property: "og:description", content: "Makan siang rumahan diantar tiap hari, atur jadwal sendiri." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:py-20">
        <div>
          <span className="rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">Katering rumahan · diantar tiap hari kerja</span>
          <h1 className="mt-5 text-4xl font-bold leading-tight md:text-6xl">Makan siang teratur, <span className="text-primary">tanpa ribet</span> pesan tiap hari.</h1>
          <p className="mt-5 text-lg text-muted-foreground">Pilih paket sekali, kami antar setiap hari. Lagi ke luar kota? Tekan <b>Libur Makan</b> — porsi Anda tidak hangus.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/pesan" className="btn-primary">Pesan Langganan</Link>
            <Link to="/menu" className="btn-outline">Lihat Menu Minggu Ini</Link>
          </div>
        </div>
        <img src={hero} width={1600} height={1104} alt="Rantang berisi nasi, ayam bakar, sayur, sambal dan tempe" className="aspect-[4/3] w-full rounded-3xl object-cover shadow-xl" />
      </section>

      <section className="bg-primary-soft py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-bold">Cara kerjanya</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ["1", "Pilih paket", "5 hari, 20 hari, atau kuota fleksibel. Tulis catatan alergi."],
              ["2", "Bayar & aktif", "Transfer atau QRIS, admin aktifkan paket Anda."],
              ["3", "Atur sendiri", "Cek sisa porsi & libur makan lewat Portal Saya sebelum jam 20:00."],
            ].map(([n, t, d]) => (
              <div key={n} className="card-box">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">{n}</div>
                <h3 className="mt-4 text-xl font-semibold">{t}</h3>
                <p className="mt-1 text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex items-end justify-between">
          <h2 className="text-3xl font-bold">Menu minggu ini</h2>
          <Link to="/menu" className="text-sm font-semibold text-primary">Detail gizi →</Link>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {WEEK_MENU.map((m) => (
            <div key={m.day} className="card-box">
              <p className="text-xs font-semibold uppercase text-primary">{DAY_NAMES[m.day]}</p>
              <p className="mt-1 font-display text-lg font-semibold">{m.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{m.kcal} kkal</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4">
        <h2 className="text-3xl font-bold">Paket</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {(Object.entries(PACKAGES) as [PackageId, (typeof PACKAGES)[PackageId]][]).map(([id, p]) => (
            <div key={id} className={`card-box flex flex-col ${id === "20hari" ? "border-primary ring-2 ring-primary" : ""}`}>
              {id === "20hari" && <span className="mb-2 w-fit rounded-full bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning-foreground">Paling hemat</span>}
              <h3 className="text-2xl font-semibold">{p.name}</h3>
              <p className="text-muted-foreground">{p.desc}</p>
              <p className="mt-4 text-3xl font-bold">{rupiah(p.price)}</p>
              <p className="text-sm text-muted-foreground">{p.pax} porsi · {rupiah(Math.round(p.price / p.pax))}/porsi</p>
              <Link to="/pesan" search={{ paket: id }} className="btn-primary mt-5">Pilih paket</Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
