import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase, Court, isMockMode } from '../lib/supabase';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Activity, Users, Clock, MapPin, ShieldAlert, Droplets, Trophy, Phone, Zap } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';

// Fewer frames = faster extraction, still smooth enough for 500vh scroll
const TOTAL_FRAMES = 60;

export const Dashboard = () => {
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollyRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState(0);
  const [framesReady, setFramesReady] = useState(false);

  // Store extracted frames as ImageBitmaps (GPU-friendly, instant draw)
  const framesRef = useRef<ImageBitmap[]>([]);
  const lastFrameIndexRef = useRef(-1);
  const lastSectionRef = useRef(-1);

  useEffect(() => { fetchCourts(); }, []);

  // ====== EXTRACT FRAMES IN BACKGROUND (silent, no blocking) ======
  useEffect(() => {
    const extractVideo = document.createElement('video');
    extractVideo.muted = true;
    extractVideo.playsInline = true;
    extractVideo.preload = 'auto';
    extractVideo.src = `/${encodeURIComponent('Tạo_Video_App_Đặt_Sân_Bóng_Rổ')}.mp4`;

    let cancelled = false;

    const extractFrames = async () => {
      await new Promise<void>((resolve, reject) => {
        extractVideo.addEventListener('loadeddata', () => resolve(), { once: true });
        extractVideo.addEventListener('error', () => reject(new Error('Video load error')), { once: true });
      });

      if (cancelled) return;

      const duration = extractVideo.duration;
      const frames: ImageBitmap[] = [];

      for (let i = 0; i < TOTAL_FRAMES; i++) {
        if (cancelled) break;

        const time = (i / (TOTAL_FRAMES - 1)) * duration;
        extractVideo.currentTime = time;

        await new Promise<void>((resolve) => {
          extractVideo.addEventListener('seeked', () => resolve(), { once: true });
        });

        try {
          const bitmap = await createImageBitmap(extractVideo);
          frames.push(bitmap);
        } catch {
          // Skip frame on error
        }
      }

      if (!cancelled && frames.length > 0) {
        framesRef.current = frames;
        setFramesReady(true);

        // Draw current scroll position frame on canvas immediately
        const canvas = canvasRef.current;
        if (canvas && frames[0]) {
          canvas.width = frames[0].width;
          canvas.height = frames[0].height;
        }
      }
    };

    // Start extraction silently after a small delay to not block initial render
    const timer = setTimeout(() => {
      extractFrames().catch(console.error);
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      framesRef.current.forEach(f => f.close());
      framesRef.current = [];
      extractVideo.src = '';
    };
  }, []);

  // ====== SCROLL-DRIVEN VIDEO/CANVAS + TEXT ======
  useEffect(() => {
    const video = videoRef.current;
    const scrolly = scrollyRef.current;
    const scroller = document.getElementById('main-scroll-container');
    
    if (!scrolly || !scroller) return;

    let rafId: number;
    let ticking = false;

    const update = () => {
      ticking = false;
      const rect = scrolly.getBoundingClientRect();
      const scrolled = -rect.top; 
      const scrollyHeight = scrolly.offsetHeight - window.innerHeight;
      if (scrollyHeight <= 0) return;

      const progress = Math.max(0, Math.min(1, scrolled / scrollyHeight));

      // If frames are ready → draw on canvas (smooth, many frames)
      const frames = framesRef.current;
      if (frames.length > 0 && canvasRef.current) {
        const frameIndex = Math.min(frames.length - 1, Math.floor(progress * frames.length));
        if (frameIndex !== lastFrameIndexRef.current) {
          lastFrameIndexRef.current = frameIndex;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          if (ctx && frames[frameIndex]) {
            if (canvas.width !== frames[frameIndex].width || canvas.height !== frames[frameIndex].height) {
              canvas.width = frames[frameIndex].width;
              canvas.height = frames[frameIndex].height;
            }
            ctx.drawImage(frames[frameIndex], 0, 0);
          }
        }
      } else if (video && video.duration && isFinite(video.duration)) {
        // Fallback: use video seeking (less smooth but works immediately)
        video.currentTime = progress * video.duration;
      }

      // Only update React state when section actually changes
      const newSection = Math.min(4, Math.floor(progress * 5));
      if (newSection !== lastSectionRef.current) {
        lastSectionRef.current = newSection;
        setActiveSection(newSection);
      }
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        rafId = requestAnimationFrame(update);
      }
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });
    update();

    return () => {
      scroller.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId);
    };
  }, [framesReady]);

  const fetchCourts = async () => {
    try {
      if (isMockMode) throw new Error('Mock mode enabled');
      const { data, error } = await supabase.from('courts').select('*');
      if (error) throw error;
      setCourts(data || []);
    } catch (error: any) {
      if (error?.message !== 'Mock mode enabled') console.error(error);
      setCourts([
        { id: '1', name: 'Sân A - Trong nhà (VIP)', status: 'available' },
        { id: '2', name: 'Sân B - Ngoài trời', status: 'maintenance' },
        { id: '3', name: 'Sân C - Cao cấp', status: 'in_use' },
      ]);
    } finally { setLoading(false); }
  };

  const getStatusColor = (s: string) => s === 'available' ? 'bg-emerald-500' : s === 'in_use' ? 'bg-orange-500' : 'bg-slate-600';
  const getStatusText = (s: string) => s === 'available' ? 'Trống' : s === 'in_use' ? 'Đang chơi' : 'Bảo trì';

  const sections = [
    { tag: 'GIỚI THIỆU', title: <>Sân Bóng Rổ<br/><span className="text-orange-400">Đẳng Cấp Quốc Tế</span></>, desc: 'Hệ thống sân bóng rổ quy chuẩn FIBA đầu tiên tại khu vực.' },
    { tag: 'CÔNG NGHỆ', title: <>Check-in Bằng<br/><span className="text-cyan-400">Mã QR Tự Động</span></>, desc: 'Quét mã trên điện thoại — cửa sân tự mở. Không cần nhân viên.' },
    { tag: 'TIÊU CHUẨN', title: <>Sàn Gỗ Chuẩn<br/><span className="text-amber-400">FIBA Quốc Tế</span></>, desc: 'Ánh sáng thi đấu chuyên nghiệp. Sàn gỗ chống trượt, đàn hồi tối ưu.' },
    { tag: 'ĐỊA ĐIỂM', title: <>CourtKings<br/><span className="text-rose-400">Arena KHTN</span></>, desc: '227 Nguyễn Văn Cừ, P.4, Q.5, TP.HCM — Mở cửa 06:00 – 22:00.' },
    { tag: 'ĐẶT SÂN', title: <>Sẵn Sàng<br/><span className="text-orange-400">Chiến Đấu?</span></>, desc: 'Đặt sân ngay hôm nay. Chỉ vài bước đơn giản.' },
  ];

  return (
    <div>
      {/* =========================================================
          SCROLLYTELLING ZONE — Hybrid: video (instant) → canvas (smooth)
          ========================================================= */}
      <div ref={scrollyRef} style={{ height: '500vh' }} className="relative">

        {/* CSS STICKY — browser handles at compositor level, zero lag */}
        <div className="sticky top-0 w-full h-screen overflow-hidden">
          
          {/* Video shows immediately, no wait */}
          <video
            ref={videoRef}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${framesReady ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            src={`/${encodeURIComponent('Tạo_Video_App_Đặt_Sân_Bóng_Rổ')}.mp4`}
            muted
            playsInline
            preload="auto"
          />

          {/* Canvas takes over once frames are extracted (smooth scrubbing) */}
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${framesReady ? 'opacity-100' : 'opacity-0'}`}
            style={{ objectFit: 'cover' }}
          />

          {/* Dark overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-black/35" />

          {/* Text sections — fade in/out based on scroll */}
          {sections.map((section, i) => (
            <div
              key={i}
              className={`absolute inset-0 flex flex-col justify-center px-8 md:px-16 transition-all duration-700 ease-out ${
                activeSection === i
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8 pointer-events-none'
              }`}
            >
              <span className="text-orange-400 text-[10px] font-bold tracking-[0.3em] uppercase mb-4 w-fit px-3 py-1 rounded-full border border-orange-500/30 bg-orange-500/10 backdrop-blur-sm">
                {section.tag}
              </span>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white leading-[1.1] drop-shadow-2xl mb-4">
                {section.title}
              </h1>
              <p className="text-white/60 text-sm md:text-base max-w-md font-light leading-relaxed">
                {section.desc}
              </p>
              {i === 4 && (
                <div className="flex gap-3 mt-6">
                  <Button onClick={() => navigate('/booking')} className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-2xl text-base font-bold shadow-2xl shadow-orange-500/40 hover:scale-105 transition-all">
                    🏀 Đặt Sân Ngay
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/checkin')} className="border-white/30 text-white hover:bg-white/10 px-6 py-4 rounded-2xl backdrop-blur-sm">
                    Check-in
                  </Button>
                </div>
              )}
            </div>
          ))}

          {/* Dot indicator */}
          <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2.5">
            {sections.map((_, i) => (
              <div key={i} className={`rounded-full transition-all duration-500 ${activeSection === i ? 'w-2 h-7 bg-orange-400' : 'w-2 h-2 bg-white/25'}`} />
            ))}
          </div>
        </div>
      </div>

      {/* ====== INFO SECTION (immediately after video) ====== */}
      <div className="bg-slate-950 px-6 md:px-12 py-14 space-y-10">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {[
            { icon: <Activity className="h-5 w-5 text-emerald-400" />, label: 'Sân trống', value: courts.filter(c => c.status === 'available').length, border: 'border-emerald-500/20' },
            { icon: <Users className="h-5 w-5 text-orange-400" />, label: 'Đang chơi', value: courts.filter(c => c.status === 'in_use').length, border: 'border-orange-500/20' },
            { icon: <Trophy className="h-5 w-5 text-blue-400" />, label: 'Tổng sân', value: courts.length, border: 'border-blue-500/20' },
            { icon: <Zap className="h-5 w-5 text-purple-400" />, label: 'Hệ thống', value: 'Online ✓', border: 'border-purple-500/20', isText: true },
          ].map((s, i) => (
            <div key={i} className={`rounded-2xl p-5 border ${s.border} bg-white/5 hover:scale-105 transition-transform`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">{s.icon}</div>
                <span className="text-sm text-slate-400">{s.label}</span>
              </div>
              <p className={`font-black ${(s as any).isText ? 'text-lg text-emerald-400' : 'text-3xl text-white'}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Courts + Info */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 max-w-5xl mx-auto">
          <div className="lg:col-span-3 space-y-6">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-3 mb-5 text-white">
                <div className="w-1 h-5 bg-orange-500 rounded-full" />
                Trạng Thái Sân
              </h2>
              <div className="space-y-3">
                {courts.map((court) => (
                  <div key={court.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex justify-between items-center hover:border-orange-500/30 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(court.status)}`} />
                      <div>
                        <h3 className="font-semibold text-white group-hover:text-orange-400 transition-colors">{court.name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{court.status === 'in_use' ? 'Đang có khách' : court.status === 'maintenance' ? 'Bảo dưỡng' : 'Sẵn sàng'}</p>
                      </div>
                    </div>
                    <Badge className={`${getStatusColor(court.status)} text-white border-0 text-xs px-3 py-1`}>{getStatusText(court.status)}</Badge>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-white/10">
                <h3 className="font-bold flex items-center gap-2 text-white"><ShieldAlert className="h-5 w-5 text-orange-400" /> Nội Quy Sân</h3>
              </div>
              <div className="p-5">
                <ul className="space-y-4 text-sm text-slate-400">
                  {['Trang bị đồ thể thao, không mang giày đế đinh cứng vào sân.','Không mang thức ăn, kẹo cao su, hút thuốc lá vào khu vực thi đấu.','Có mặt và quét QR Check-in sớm 10 phút. Đèn/cửa tự tắt khi hết giờ.','Hủy giờ đặt báo trước 24h để được hoàn 50% tiền cọc.'].map((r, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-orange-500/20 text-orange-400 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">{i+1}</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-white/10">
                <h3 className="font-bold flex items-center gap-2 text-white"><MapPin className="h-5 w-5 text-red-400" /> Địa Chỉ</h3>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-white font-semibold">CourtKings Arena KHTN</p>
                <p className="text-sm text-slate-400">227 Nguyễn Văn Cừ, P.4, Q.5, TP.HCM</p>
                <div className="flex items-center gap-2 text-sm text-slate-400"><Phone className="h-4 w-4 text-slate-500" /> Hotline: <strong className="text-orange-400">0909 xxx xxx</strong></div>
                <div className="flex items-center gap-2 text-sm text-slate-400"><Clock className="h-4 w-4 text-slate-500" /> Mở cửa: <strong className="text-white">06:00 – 22:00</strong></div>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-white/10">
                <h3 className="font-bold flex items-center gap-2 text-white"><Droplets className="h-5 w-5 text-blue-400" /> Dịch Vụ & Tiếp Sức</h3>
              </div>
              <div className="p-5">
                {[
                  { icon: '💧', name: 'Nước Suối', desc: '500ml ướp lạnh', price: '10.000đ' },
                  { icon: '⚡', name: 'Revive / Pocari', desc: 'Bù khoáng', price: '15.000đ' },
                  { icon: '🏀', name: 'Thuê bóng Spalding', desc: 'Size 7 FIBA', price: '30.000đ/ca' },
                  { icon: '🧊', name: 'Đá viên', desc: 'Ly/xô nhỏ', price: 'Miễn phí', free: true },
                ].map((item, i) => (
                  <div key={i} className={`flex justify-between items-center py-3.5 ${i < 3 ? 'border-b border-white/5' : ''}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{item.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-white">{item.name}</p>
                        <p className="text-[11px] text-slate-500">{item.desc}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${item.free ? 'text-emerald-400' : 'text-orange-400'}`}>{item.price}</span>
                  </div>
                ))}
              </div>
            </div>
            <Button onClick={() => navigate('/booking')} className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white py-6 rounded-2xl text-lg font-bold shadow-2xl shadow-orange-500/20 hover:scale-[1.02] transition-all">
              🏀 Đặt Sân Ngay
            </Button>
          </div>
        </div>
        <div className="text-center text-slate-600 text-xs pt-8 border-t border-white/5">© 2026 CourtKings Arena</div>
      </div>
    </div>
  );
};
