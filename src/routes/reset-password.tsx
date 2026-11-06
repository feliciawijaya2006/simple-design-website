import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Atur Ulang Kata Sandi — RantangKu" },
    { name: "description", content: "Buat kata sandi baru untuk akun RantangKu." },
    { property: "og:title", content: "Atur Ulang Kata Sandi — RantangKu" },
    { property: "og:description", content: "Buat kata sandi baru untuk akun RantangKu." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { name: "robots", content: "noindex" },
  ] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");
    if (!isRecovery) { setError("Tautan pemulihan tidak valid. Minta tautan baru dari halaman masuk."); return; }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setValid(true);
      else setError("Sesi pemulihan tidak ditemukan. Minta tautan baru dari halaman masuk.");
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    await supabase.auth.signOut();
    setDone(true);
    await navigate({ to: "/auth", replace: true });
  }

  return <div className="mx-auto max-w-md px-4 py-12"><div className="card-box">
    <h1 className="text-3xl font-bold">Kata sandi baru</h1>
    {done ? <p className="mt-3">Kata sandi berhasil diubah. <Link to="/auth" className="font-semibold text-primary">Masuk sekarang</Link></p> :
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm">Kata sandi baru<input required minLength={8} type="password" autoComplete="new-password" className="input-field mt-1" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <p role="alert" className="rounded-lg bg-warning-soft p-3 text-sm text-warning-foreground">{error}</p>}
        <button disabled={!valid || busy} className="btn-primary w-full">{busy ? "Menyimpan…" : "Simpan kata sandi"}</button>
        {!valid && <Link to="/auth" className="btn-outline w-full">Kembali ke halaman masuk</Link>}
      </form>}
  </div></div>;
}
