CREATE TYPE public.app_role AS ENUM ('admin', 'customer');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

CREATE TABLE public.weekly_menus (
  day SMALLINT PRIMARY KEY CHECK (day BETWEEN 1 AND 5),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Rumahan',
  kcal INTEGER NOT NULL CHECK (kcal >= 0),
  allergens TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.weekly_menus TO anon, authenticated;
GRANT UPDATE ON public.weekly_menus TO authenticated;
GRANT ALL ON public.weekly_menus TO service_role;

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code TEXT NOT NULL UNIQUE DEFAULT ('RK-' || upper(substr(md5(gen_random_uuid()::text), 1, 8))),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pkg TEXT NOT NULL CHECK (pkg IN ('5hari', '20hari', 'fleksibel')),
  total_portions INTEGER NOT NULL CHECK (total_portions > 0),
  remaining_portions INTEGER NOT NULL CHECK (remaining_portions >= 0),
  price INTEGER NOT NULL CHECK (price >= 0),
  status TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'aktif', 'selesai')),
  paid BOOLEAN NOT NULL DEFAULT false,
  start_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

CREATE TABLE public.meal_skips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  skip_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, skip_date)
);
GRANT SELECT ON public.meal_skips TO authenticated;
GRANT ALL ON public.meal_skips TO service_role;

CREATE TABLE public.meal_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  portions INTEGER NOT NULL CHECK (portions > 0),
  status TEXT NOT NULL DEFAULT 'terjadwal' CHECK (status IN ('terjadwal', 'terkirim', 'batal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.meal_bookings TO authenticated;
GRANT ALL ON public.meal_bookings TO service_role;
CREATE UNIQUE INDEX one_active_flexible_booking_per_date ON public.meal_bookings (subscription_id, booking_date) WHERE status = 'terjadwal';

CREATE TABLE public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  delivery_date DATE NOT NULL,
  portions INTEGER NOT NULL CHECK (portions > 0),
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, delivery_date)
);
GRANT SELECT ON public.deliveries TO authenticated;
GRANT ALL ON public.deliveries TO service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, address, area, notes)
  VALUES (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'address', ''),
    coalesce(new.raw_user_meta_data->>'area', ''),
    coalesce(new.raw_user_meta_data->>'notes', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile and admins read all" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles and admins read all" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.weekly_menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads weekly menus" ON public.weekly_menus FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins update weekly menus" ON public.weekly_menus FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own subscriptions and admins read all" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create own subscriptions" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update subscriptions" ON public.subscriptions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete subscriptions" ON public.subscriptions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.meal_skips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own skips and admins read all" ON public.meal_skips FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.id = subscription_id AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

ALTER TABLE public.meal_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own bookings and admins read all" ON public.meal_bookings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.id = subscription_id AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own deliveries and admins read all" ON public.deliveries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.id = subscription_id AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE OR REPLACE FUNCTION public.toggle_meal_skip(p_subscription_id UUID, p_date DATE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO v_sub FROM public.subscriptions WHERE id = p_subscription_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Langganan tidak ditemukan'; END IF;
  IF v_sub.status <> 'aktif' THEN RAISE EXCEPTION 'Langganan belum aktif'; END IF;
  IF v_sub.pkg = 'fleksibel' THEN RAISE EXCEPTION 'Paket fleksibel menggunakan jadwal porsi'; END IF;
  IF now() >= (((p_date - 1)::timestamp + time '20:00') AT TIME ZONE 'Asia/Makassar') THEN RAISE EXCEPTION 'Batas perubahan jam 20:00 H-1 sudah lewat'; END IF;
  IF EXISTS (SELECT 1 FROM public.deliveries WHERE subscription_id = p_subscription_id AND delivery_date = p_date) THEN RAISE EXCEPTION 'Pengiriman sudah tercatat'; END IF;
  IF EXISTS (SELECT 1 FROM public.meal_skips WHERE subscription_id = p_subscription_id AND skip_date = p_date) THEN
    DELETE FROM public.meal_skips WHERE subscription_id = p_subscription_id AND skip_date = p_date;
  ELSE
    INSERT INTO public.meal_skips (subscription_id, skip_date) VALUES (p_subscription_id, p_date);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.toggle_meal_skip(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_meal_skip(UUID, DATE) TO authenticated;

CREATE OR REPLACE FUNCTION public.book_flexible_meal(p_subscription_id UUID, p_date DATE, p_portions INTEGER)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.subscriptions%ROWTYPE;
  v_booking_id UUID;
BEGIN
  IF p_portions IS NULL OR p_portions < 1 THEN RAISE EXCEPTION 'Jumlah porsi minimal 1'; END IF;
  IF extract(isodow FROM p_date) NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Pengiriman hanya Senin sampai Jumat'; END IF;
  SELECT * INTO v_sub FROM public.subscriptions WHERE id = p_subscription_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Langganan tidak ditemukan'; END IF;
  IF v_sub.status <> 'aktif' THEN RAISE EXCEPTION 'Langganan belum aktif'; END IF;
  IF v_sub.pkg <> 'fleksibel' THEN RAISE EXCEPTION 'Jadwal porsi hanya untuk paket fleksibel'; END IF;
  IF p_date < v_sub.start_date THEN RAISE EXCEPTION 'Tanggal sebelum langganan dimulai'; END IF;
  IF now() >= (((p_date - 1)::timestamp + time '20:00') AT TIME ZONE 'Asia/Makassar') THEN RAISE EXCEPTION 'Batas pemesanan jam 20:00 H-1 sudah lewat'; END IF;
  IF p_portions > v_sub.remaining_portions THEN RAISE EXCEPTION 'Sisa kuota hanya % porsi', v_sub.remaining_portions; END IF;
  INSERT INTO public.meal_bookings (subscription_id, booking_date, portions) VALUES (p_subscription_id, p_date, p_portions) RETURNING id INTO v_booking_id;
  UPDATE public.subscriptions SET remaining_portions = remaining_portions - p_portions WHERE id = p_subscription_id;
  RETURN v_booking_id;
END;
$$;
REVOKE ALL ON FUNCTION public.book_flexible_meal(UUID, DATE, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_flexible_meal(UUID, DATE, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_flexible_meal(p_booking_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.meal_bookings%ROWTYPE;
BEGIN
  SELECT b.* INTO v_booking FROM public.meal_bookings b JOIN public.subscriptions s ON s.id = b.subscription_id WHERE b.id = p_booking_id AND s.user_id = auth.uid() AND b.status = 'terjadwal' FOR UPDATE OF b, s;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jadwal tidak ditemukan'; END IF;
  IF now() >= (((v_booking.booking_date - 1)::timestamp + time '20:00') AT TIME ZONE 'Asia/Makassar') THEN RAISE EXCEPTION 'Batas pembatalan jam 20:00 H-1 sudah lewat'; END IF;
  UPDATE public.meal_bookings SET status = 'batal' WHERE id = p_booking_id;
  UPDATE public.subscriptions SET remaining_portions = remaining_portions + v_booking.portions, status = 'aktif' WHERE id = v_booking.subscription_id;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_flexible_meal(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_flexible_meal(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_meal_delivered(p_subscription_id UUID, p_date DATE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.subscriptions%ROWTYPE;
  v_booking public.meal_bookings%ROWTYPE;
  v_portions INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Akses admin diperlukan'; END IF;
  SELECT * INTO v_sub FROM public.subscriptions WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Langganan tidak ditemukan'; END IF;
  IF v_sub.status <> 'aktif' THEN RAISE EXCEPTION 'Langganan tidak aktif'; END IF;
  IF EXISTS (SELECT 1 FROM public.deliveries WHERE subscription_id = p_subscription_id AND delivery_date = p_date) THEN RETURN; END IF;
  IF v_sub.pkg = 'fleksibel' THEN
    SELECT * INTO v_booking FROM public.meal_bookings WHERE subscription_id = p_subscription_id AND booking_date = p_date AND status = 'terjadwal' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Tidak ada jadwal fleksibel pada tanggal ini'; END IF;
    v_portions := v_booking.portions;
    UPDATE public.meal_bookings SET status = 'terkirim' WHERE id = v_booking.id;
  ELSE
    IF v_sub.start_date > p_date THEN RAISE EXCEPTION 'Langganan belum dimulai'; END IF;
    IF EXISTS (SELECT 1 FROM public.meal_skips WHERE subscription_id = p_subscription_id AND skip_date = p_date) THEN RAISE EXCEPTION 'Pelanggan sedang libur makan'; END IF;
    IF v_sub.remaining_portions < 1 THEN RAISE EXCEPTION 'Kuota habis'; END IF;
    v_portions := 1;
  END IF;
  INSERT INTO public.deliveries (subscription_id, delivery_date, portions) VALUES (p_subscription_id, p_date, v_portions);
  IF v_sub.pkg = 'fleksibel' THEN
    UPDATE public.subscriptions SET status = CASE WHEN remaining_portions = 0 AND NOT EXISTS (SELECT 1 FROM public.meal_bookings WHERE subscription_id = p_subscription_id AND status = 'terjadwal') THEN 'selesai' ELSE status END WHERE id = p_subscription_id;
  ELSE
    UPDATE public.subscriptions SET remaining_portions = remaining_portions - 1, status = CASE WHEN remaining_portions - 1 = 0 THEN 'selesai' ELSE status END WHERE id = p_subscription_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_meal_delivered(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_meal_delivered(UUID, DATE) TO authenticated;

INSERT INTO public.weekly_menus (day, title, description, category, kcal, allergens) VALUES
(1, 'Ayam Bakar Madu', 'Nasi, ayam bakar madu, tumis buncis, tempe goreng, sambal', 'Rumahan', 640, ARRAY['Kedelai']),
(2, 'Ikan Kembung Balado', 'Nasi, kembung balado, sayur asem, perkedel kentang', 'Rumahan', 590, ARRAY['Ikan']),
(3, 'Rendang Daging', 'Nasi, rendang sapi, daun singkong, telur balado', 'Spesial', 720, ARRAY['Telur']),
(4, 'Chicken Teriyaki Sehat', 'Nasi merah, ayam teriyaki, brokoli kukus, wortel', 'Sehat', 520, ARRAY['Kedelai', 'Wijen']),
(5, 'Soto Ayam Lamongan', 'Nasi, soto ayam, koya, telur rebus, kerupuk', 'Rumahan', 610, ARRAY['Telur', 'Udang']);
