import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Tables } from "@/integrations/supabase/types";
import { PACKAGES, type MealBooking, type Menu, type PackageId, type Profile, type Status, type Subscription } from "@/lib/catering";

type AuthContext = { supabase: any; userId: string };

async function requireAdmin(context: AuthContext) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !data) throw new Error("Akses admin diperlukan.");
}

function mapSubscriptions(
  rows: Tables<"subscriptions">[],
  profiles: Tables<"profiles">[],
  skips: Tables<"meal_skips">[],
  bookings: Tables<"meal_bookings">[],
  deliveries: Tables<"deliveries">[],
): Subscription[] {
  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  return rows.map((s) => {
    const profile = profileMap.get(s.user_id);
    return {
      id: s.id,
      code: s.order_code,
      userId: s.user_id,
      name: profile?.full_name ?? "Pelanggan",
      phone: profile?.phone ?? "",
      address: profile?.address ?? "",
      area: profile?.area ?? "",
      notes: profile?.notes ?? "",
      pkg: s.pkg as PackageId,
      total: s.total_portions,
      remaining: s.remaining_portions,
      price: s.price,
      status: s.status as Status,
      paid: s.paid,
      start: s.start_date,
      createdAt: s.created_at,
      skips: skips.filter((x) => x.subscription_id === s.id).map((x) => x.skip_date),
      bookings: bookings.filter((x) => x.subscription_id === s.id).map((x) => ({ id: x.id, date: x.booking_date, portions: x.portions, status: x.status as MealBooking["status"] })),
      delivered: deliveries.filter((x) => x.subscription_id === s.id).map((x) => ({ date: x.delivery_date, portions: x.portions })),
    };
  });
}

async function loadRelations(supabase: any, ids: string[]) {
  let skips: Tables<"meal_skips">[] = [];
  let bookings: Tables<"meal_bookings">[] = [];
  let deliveries: Tables<"deliveries">[] = [];
  if (ids.length > 0) {
    const [skipResult, bookingResult, deliveryResult] = await Promise.all([
      supabase.from("meal_skips").select("*").in("subscription_id", ids),
      supabase.from("meal_bookings").select("*").in("subscription_id", ids).order("booking_date"),
      supabase.from("deliveries").select("*").in("subscription_id", ids).order("delivery_date"),
    ]);
    if (skipResult.error) throw new Error(skipResult.error.message);
    if (bookingResult.error) throw new Error(bookingResult.error.message);
    if (deliveryResult.error) throw new Error(deliveryResult.error.message);
    skips = skipResult.data ?? [];
    bookings = bookingResult.data ?? [];
    deliveries = deliveryResult.data ?? [];
  }
  return { skips, bookings, deliveries };
}

export const getWeeklyMenu = createServerFn({ method: "GET" }).handler(async (): Promise<Menu[]> => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const supabase = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
  const { data, error } = await supabase.from("weekly_menus").select("*").order("day");
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => ({ day: m.day, title: m.title, desc: m.description, category: m.category, kcal: m.kcal, allergens: m.allergens }));
});

export const getCurrentRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<"admin" | "customer"> => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return data ? "admin" : "customer";
  });

export const getPortalData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: profile, error: profileError }, { data: rows, error: subError }] = await Promise.all([
      context.supabase.from("profiles").select("*").eq("id", context.userId).single(),
      context.supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),
    ]);
    if (profileError) throw new Error(profileError.message);
    if (subError) throw new Error(subError.message);
    const subscriptions = (rows ?? []) as Tables<"subscriptions">[];
    const relations = await loadRelations(context.supabase, subscriptions.map((s) => s.id));
    const mappedProfile: Profile = { id: profile.id, name: profile.full_name, phone: profile.phone, address: profile.address, area: profile.area, notes: profile.notes };
    return { profile: mappedProfile, subscriptions: mapSubscriptions(subscriptions, [profile], relations.skips, relations.bookings, relations.deliveries) };
  });

export const getAdminData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const [{ data: profiles, error: profileError }, { data: rows, error: subError }] = await Promise.all([
      context.supabase.from("profiles").select("*"),
      context.supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),
    ]);
    if (profileError) throw new Error(profileError.message);
    if (subError) throw new Error(subError.message);
    const subscriptions = (rows ?? []) as Tables<"subscriptions">[];
    const relations = await loadRelations(context.supabase, subscriptions.map((s) => s.id));
    return mapSubscriptions(subscriptions, profiles ?? [], relations.skips, relations.bookings, relations.deliveries);
  });

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { pkg: PackageId; start: string; name: string; phone: string; address: string; area: string; notes: string }) => data)
  .handler(async ({ data, context }) => {
    const p = PACKAGES[data.pkg];
    if (!p || !/^\d{4}-\d{2}-\d{2}$/.test(data.start) || !data.name.trim() || !data.phone.trim() || !data.address.trim()) throw new Error("Data pesanan belum lengkap.");
    const { error: profileError } = await context.supabase.from("profiles").update({ full_name: data.name.trim(), phone: data.phone.trim(), address: data.address.trim(), area: data.area, notes: data.notes.trim(), updated_at: new Date().toISOString() }).eq("id", context.userId);
    if (profileError) throw new Error(profileError.message);
    const { data: order, error } = await context.supabase.from("subscriptions").insert({ user_id: context.userId, pkg: data.pkg, total_portions: p.pax, remaining_portions: p.pax, price: p.price, start_date: data.start }).select("id, order_code").single();
    if (error) throw new Error(error.message);
    return order as { id: string; order_code: string };
  });

export const toggleSkip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { subscriptionId: string; date: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("toggle_meal_skip", { p_subscription_id: data.subscriptionId, p_date: data.date });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bookFlexible = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { subscriptionId: string; date: string; portions: number }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("book_flexible_meal", { p_subscription_id: data.subscriptionId, p_date: data.date, p_portions: data.portions });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelFlexible = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bookingId: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("cancel_flexible_meal", { p_booking_id: data.bookingId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const verifySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase.from("subscriptions").update({ status: "aktif", paid: true }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase.from("subscriptions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markDelivered = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { subscriptionId: string; date: string }) => data)
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase.rpc("mark_meal_delivered", { p_subscription_id: data.subscriptionId, p_date: data.date });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Menu) => data)
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    if (data.day < 1 || data.day > 5 || !data.title.trim() || data.kcal < 0) throw new Error("Menu belum valid.");
    const { error } = await context.supabase.from("weekly_menus").update({ title: data.title.trim(), description: data.desc.trim(), category: data.category.trim(), kcal: data.kcal, allergens: data.allergens, updated_at: new Date().toISOString() }).eq("day", data.day);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
