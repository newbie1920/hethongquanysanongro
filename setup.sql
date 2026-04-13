CREATE TABLE IF NOT EXISTS public.courts (
    id text PRIMARY KEY,
    name text NOT NULL,
    status text NOT NULL DEFAULT 'available' -- 'available', 'in_use', 'maintenance'
);

CREATE TABLE IF NOT EXISTS public.bookings (
    id text PRIMARY KEY,
    court_id text NOT NULL REFERENCES public.courts(id),
    court_name text NOT NULL,
    user_id text NOT NULL,
    user_email text NOT NULL,
    customer_name text NOT NULL DEFAULT '',
    customer_phone text NOT NULL,
    date text NOT NULL,
    ranges jsonb NOT NULL,
    total integer NOT NULL,
    paid boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- Bật Row Level Security (RLS) bảo vệ dữ liệu nhưng tạm thời cho phép đọc/ghi thoải mái để test:
ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Courts:
DROP POLICY IF EXISTS "Cho phép tất cả xem courts" ON public.courts;
CREATE POLICY "Cho phép tất cả xem courts" ON public.courts FOR SELECT USING (true);

-- Bookings: 
DROP POLICY IF EXISTS "Cho phép tất cả xem bookings" ON public.bookings;
CREATE POLICY "Cho phép tất cả xem bookings" ON public.bookings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Cho phép insert bookings" ON public.bookings;
CREATE POLICY "Cho phép insert bookings" ON public.bookings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Cho phép update bookings" ON public.bookings;
CREATE POLICY "Cho phép update bookings" ON public.bookings FOR UPDATE USING (true);

-- Insert dummy data cho sân
INSERT INTO public.courts (id, name, status) VALUES 
('1', 'Sân A - Trong nhà (VIP)', 'available'),
('2', 'Sân B - Ngoài trời', 'available')
ON CONFLICT (id) DO NOTHING;
