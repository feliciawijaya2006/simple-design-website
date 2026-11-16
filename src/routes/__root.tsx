import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useNavigate,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentRole } from "@/lib/catering.functions";
import { Button } from "@/components/ui/button";
import { LogOut, ShieldCheck } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ADMIN_WA } from "../lib/catering";

function SiteHeader({ user, admin, onSignOut, signingOut }: { user: User | null; admin: boolean; onSignOut: () => Promise<void>; signingOut: boolean }) {
  const links = admin ? [
    { to: "/admin", label: "Dashboard Admin" },
    { to: "/menu", label: "Lihat Menu" },
  ] as const : [
    { to: "/menu", label: "Menu" },
    { to: "/pesan", label: "Pesan" },
    ...(user ? [{ to: "/portal", label: "Portal Saya" } as const] : []),
  ] as const;
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link to={admin ? "/admin" : "/"} className="flex items-center gap-2 font-display text-2xl font-bold text-primary">RantangKu {admin && <ShieldCheck className="size-5" aria-label="Admin" />}</Link>
        <nav aria-label={admin ? "Navigasi admin" : "Navigasi pelanggan"} className="flex flex-wrap items-center gap-1 text-sm font-medium">
          {links.map((l) => (
            <Button key={l.to} asChild variant="ghost"><Link to={l.to} activeProps={{ className: "bg-accent text-accent-foreground" }}>{l.label}</Link></Button>
          ))}
          {user ? <Button variant="outline" disabled={signingOut} onClick={onSignOut}><LogOut />{signingOut ? "Keluar…" : "Keluar"}</Button> : <Button asChild><Link to="/auth" search={{}}>Masuk / Daftar</Link></Button>}
        </nav>
      </div>
    </header>
  );
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "RantangKu — Katering Rantangan Harian" },
      { name: "description", content: "Pesan katering rantangan harian & langganan dengan mudah." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const navigate = useNavigate();
  const fetchRole = useServerFn(getCurrentRole);
  const [user, setUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let alive = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setUser(session?.user ?? null);
      if (event === "SIGNED_OUT") setAdmin(false);
      void router.invalidate();
      if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
    });
    void supabase.auth.getUser().then(({ data }) => { if (alive) setUser(data.user); }).catch(() => undefined);
    return () => { alive = false; subscription.unsubscribe(); };
  }, [router, queryClient]);

  useEffect(() => {
    let alive = true;
    setAdmin(false);
    if (user) void fetchRole().then((role) => { if (alive) setAdmin(role === "admin"); }).catch(() => undefined);
    return () => { alive = false; };
  }, [user?.id, fetchRole]);

  async function signOut() {
    setSigningOut(true);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null); setAdmin(false);
      await navigate({ to: "/auth", search: {}, replace: true });
    } finally { setSigningOut(false); }
  }

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <SiteHeader user={user} admin={admin} onSignOut={signOut} signingOut={signingOut} />
      <main className="min-h-[70vh]"><Outlet /></main>
      <footer className="mt-16 border-t py-8 text-center text-sm text-muted-foreground">
        © 2026 RantangKu · Masakan rumahan, diantar tiap hari
      </footer>
      {!admin && <a href={`https://wa.me/${ADMIN_WA}`} target="_blank" rel="noreferrer" className="btn-primary fixed bottom-5 right-5 z-50 shadow-lg">💬 Tanya via WA</a>}
    </QueryClientProvider>
  );
}
