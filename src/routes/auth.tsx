import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AREAS } from "@/lib/catering";
import { getCurrentRole } from "@/lib/catering.functions";

type Mode = "login" | "signup" | "forgot";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({ redirect: typeof search["redirect"] === "string" && search["redirect"].startsWith("/") && !search["redirect"].startsWith("//") ? search["redirect"] : undefined }),
  head: () => ({ meta: [
    { title: "Masuk atau Daftar — RantangKu" },
    { name: "description", content: "Masuk ke Portal Saya atau dashboard admin RantangKu." },
    { property: "og:title", content: "Masuk atau Daftar — RantangKu" },
    { property: "og:description", content: "Satu akun untuk memesan dan mengatur jadwal makan Anda." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { name: "robots", content: "noindex" },
  ] }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const fetchRole = useServerFn(getCurrentRole);
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "", name: "", phone: "", address: "", area: AREAS[0] ?? "", notes: "" });

  async function goToAccount() {
    const role = await fetchRole();
    const fallback = role === "admin" ? "/admin" : "/portal";
    await navigate({ to: search.redirect ?? fallback, replace: true });
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => { if (data.user) await goToAccount(); }).catch(() => undefined);
    // Only the initial session needs checking on this public page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (error) throw error;
        await goToAccount();
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { emailRedirectTo: `${window.location.origin}/auth`, data: { full_name: form.name, phone: form.phone, address: form.address, area: form.area, notes: form.notes } },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage("Pendaftaran berhasil. Buka email Anda dan klik tautan konfirmasi sebelum masuk.");
        } else {
          await goToAccount();
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(form.email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setMessage("Tautan atur ulang kata sandi telah dikirim ke email Anda.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan. Coba lagi.");
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="card-box">
        <p className="text-sm font-semibold text-primary">Akun RantangKu</p>
        <h1 className="mt-1 text-4xl font-bold">{mode === "signup" ? "Daftar pelanggan" : mode === "forgot" ? "Lupa kata sandi" : "Masuk ke akun"}</h1>
        <p className="mt-2 text-muted-foreground">Pelanggan dan admin otomatis diarahkan ke tampilan masing-masing.</p>
        <div className="mt-6 flex gap-1 rounded-full bg-muted p-1">
          <button type="button" onClick={() => { setMode("login"); setError(""); setMessage(""); }} className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${mode !== "signup" ? "bg-card shadow" : ""}`}>Masuk</button>
          <button type="button" onClick={() => { setMode("signup"); setError(""); setMessage(""); }} className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${mode === "signup" ? "bg-card shadow" : ""}`}>Daftar</button>
        </div>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm">Email<input required type="email" autoComplete="email" className="input-field mt-1" value={form.email} onChange={set("email")} /></label>
          {mode !== "forgot" && <label className="block text-sm">Kata sandi<input required minLength={8} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} className="input-field mt-1" value={form.password} onChange={set("password")} /></label>}
          {mode === "signup" && <>
            <label className="block text-sm">Nama lengkap<input required className="input-field mt-1" value={form.name} onChange={set("name")} /></label>
            <label className="block text-sm">Nomor WhatsApp<input required inputMode="tel" placeholder="08xxxxxxxxxx" className="input-field mt-1" value={form.phone} onChange={set("phone")} /></label>
            <label className="block text-sm">Alamat lengkap<textarea required rows={2} className="input-field mt-1" value={form.address} onChange={set("address")} /></label>
            <label className="block text-sm">Wilayah<select className="input-field mt-1" value={form.area} onChange={set("area")}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select></label>
            <label className="block text-sm">Catatan alergi / pantangan (opsional)<textarea rows={2} className="input-field mt-1" value={form.notes} onChange={set("notes")} /></label>
          </>}
          {error && <p role="alert" className="rounded-lg bg-warning-soft p-3 text-sm text-warning-foreground">{error}</p>}
          {message && <p role="status" className="rounded-lg bg-accent p-3 text-sm text-accent-foreground">{message}</p>}
          <button disabled={busy} className="btn-primary w-full">{busy ? "Memproses…" : mode === "login" ? "Masuk" : mode === "signup" ? "Buat akun" : "Kirim tautan pemulihan"}</button>
        </form>
        {mode === "login" && <button type="button" className="mt-4 w-full text-sm font-semibold text-primary" onClick={() => { setMode("forgot"); setError(""); }}>Lupa kata sandi?</button>}
        {mode === "forgot" && <button type="button" className="mt-4 w-full text-sm font-semibold text-primary" onClick={() => setMode("login")}>Kembali masuk</button>}
      </div>
    </div>
  );
}
