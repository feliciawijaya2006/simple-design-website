import { createFileRoute, Link } from "@tanstack/react-router";
import { WEEK_MENU, DAY_NAMES } from "@/lib/catering";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menu Mingguan — RantangKu" },
      { name: "description", content: "Jadwal menu harian RantangKu lengkap dengan kalori dan info alergen." },
      { property: "og:title", content: "Menu Mingguan — RantangKu" },
      { property: "og:description", content: "Jadwal menu Senin–Jumat dengan info gizi dan alergen." },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const todayIdx = new Date().getDay();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-4xl font-bold">Menu minggu ini</h1>
      <p className="mt-2 text-muted-foreground">Diantar Senin–Jumat, pukul 10.30–12.00. Ada alergi? Tulis di catatan saat memesan.</p>
      <div className="mt-8 space-y-3">
        {WEEK_MENU.map((m) => (
          <div key={m.day} className={`card-box flex flex-col gap-3 sm:flex-row sm:items-center ${m.day === todayIdx ? "border-primary ring-2 ring-primary" : ""}`}>
            <div className="w-24 shrink-0">
              <p className="font-display text-xl font-bold text-primary">{DAY_NAMES[m.day]}</p>
              {m.day === todayIdx && <p className="text-xs font-semibold">Hari ini</p>}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold">{m.title}</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{m.category}</span>
              </div>
              <p className="text-muted-foreground">{m.desc}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-accent-foreground">{m.kcal} kkal</span>
                {m.allergens.map((a) => <span key={a} className="rounded-full bg-warning-soft px-2 py-0.5 font-semibold text-warning-foreground">Mengandung {a}</span>)}
              </div>
            </div>
          </div>
        ))}
      </div>
      <Link to="/pesan" className="btn-primary mt-8">Pesan Langganan</Link>
    </div>
  );
}
