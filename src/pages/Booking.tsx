import React, { useState, useEffect, useMemo } from 'react';
import { supabase, Court, isMockMode } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '../lib/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { addDays, format, isSameDay, startOfToday } from 'date-fns';
import { vi } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { Info } from 'lucide-react';
import { saveBooking, markBookingPaid } from '../lib/bookingStore';

type BookedSlot = { date: string; hour: number };

export const Booking = () => {
  const { user } = useAuth();
  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedCourt, setSelectedCourt] = useState('1');
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [selectedHours, setSelectedHours] = useState<number[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [receiptData, setReceiptData] = useState<{
    date: Date;
    total: number;
    phone: string;
    ranges: {start: number, end: number}[];
  } | null>(null);

  const next7Days = useMemo(() => {
    const today = startOfToday();
    return Array.from({ length: 7 }).map((_, i) => addDays(today, i));
  }, []);

  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);

  useEffect(() => {
    fetchCourts();
  }, []);

  const fetchCourts = async () => {
    try {
      if (isMockMode) throw new Error('Mock mode enabled');
      const { data, error } = await supabase.from('courts').select('*');
      if (error) throw error;
      setCourts(data || []);
    } catch (error: any) {
      if (error?.message !== 'Mock mode enabled') {
        console.error('Error fetching courts:', error);
      }
      setCourts([
        { id: '1', name: 'Sân A - Trong nhà (VIP)', status: 'available' },
        { id: '2', name: 'Sân B - Ngoài trời', status: 'available' },
      ]);
    }
  };

  const getDayStatus = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayBookings = bookedSlots.filter(b => b.date === dateStr);
    const hasMorning = dayBookings.some(b => b.hour >= 6 && b.hour < 12);
    const hasAfternoon = dayBookings.some(b => b.hour >= 12 && b.hour < 18);
    const hasEvening = dayBookings.some(b => b.hour >= 18 && b.hour <= 23);
    return { hasMorning, hasAfternoon, hasEvening };
  };

  const handleHourClick = (hour: number) => {
    const isBooked = bookedSlots.some(
      b => b.date === format(selectedDate, 'yyyy-MM-dd') && b.hour === hour
    );
    if (isBooked) return;

    setSelectedHours(prev => {
      // Logic: nếu ấn vào giờ đã chọn thì bỏ chọn, nếu chưa thì thêm vào (cho phép chọn ngắt quãng hoặc liên tục)
      if (prev.includes(hour)) {
        return prev.filter(h => h !== hour);
      }
      return [...prev, hour].sort((a, b) => a - b);
    });
  };

  // Tính giá tuỳ theo giờ
  const getPricePerHour = (hour: number) => {
    if (hour < 12) return 100000; // Sáng (6h-12h): 100k
    if (hour < 17) return 80000;  // Trưa/Chiều (12h-17h): 80k (rẻ hơn do nắng)
    return 150000;                // Tối (17h-23h): 150k (Giờ vàng)
  };

  const calculateTotal = () => {
    return selectedHours.reduce((acc, hour) => acc + getPricePerHour(hour), 0);
  };

  const handleBooking = async () => {
    if (selectedHours.length === 0 || !user) {
      toast.error('Vui lòng chọn ít nhất 1 khung giờ!');
      return;
    }
    
    if (!customerPhone || customerPhone.trim().length < 9) {
      toast.error('Vui lòng nhập Số điện thoại hợp lệ để xác nhận!');
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));

      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Tạo mã QR bao gồm tất cả các giờ
      const ranges = getSelectedRanges();
      const timeStr = ranges.map(r => `T${r.start}to${r.end}`).join('_');
      
      const qrString = `COURT_${selectedCourt}_DATE_${dateStr}_${timeStr}_USER_${user.id}`;
      
      setBookedSlots(prev => [
        ...prev,
        ...selectedHours.map(hour => ({ date: dateStr, hour }))
      ]);

      // Lưu booking vào store chung để trang Điều khiển có thể đọc
      const courtName = courts.find(c => c.id === selectedCourt)?.name || `Sân ${selectedCourt}`;
      const bookingId = `BK_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await saveBooking({
        id: bookingId,
        courtId: selectedCourt,
        courtName,
        userId: user.id,
        userEmail: user.email || '',
        customerPhone: customerPhone,
        date: dateStr,
        ranges: getSelectedRanges(),
        total: calculateTotal(),
        paid: true, // Đặt = đã thanh toán (trong thực tế sẽ check từ payment gateway)
        createdAt: new Date().toISOString(),
      });

      toast.success('Đặt sân thành công! Cảm ơn bạn.');
      setQrCode(qrString);
      setReceiptData({
         date: selectedDate,
         total: calculateTotal(),
         phone: customerPhone,
         ranges: getSelectedRanges()
      });
      setShowQR(true);
      // Giờ đã lưu vào receiptData, có thể xóa selectedHours thoải mái
      setSelectedHours([]);
    } catch (error) {
      toast.error('Lỗi khi đặt sân.');
    } finally {
      setLoading(false);
    }
  };

  // Gộp các giờ liên tục thành khoảng (vd: 6,7,8 -> 6:00 đến 9:00)
  const getSelectedRanges = () => {
    if (selectedHours.length === 0) return [];
    
    let ranges = [];
    let start = selectedHours[0];
    let end = start + 1;

    for (let i = 1; i < selectedHours.length; i++) {
        if (selectedHours[i] === end) {
            // Liên tục
            end++;
        } else {
            // Bị ngắt quãng
            ranges.push({ start, end });
            start = selectedHours[i];
            end = start + 1;
        }
    }
    ranges.push({ start, end });
    return ranges;
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-24">
      <div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3 text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-500 drop-shadow-sm">
          Lịch Sân {courts.find(c => c.id === selectedCourt)?.name?.split('-')[0] || ''}
        </h1>
        <p className="text-slate-500 text-lg max-w-2xl">Trải nghiệm đặt sân thế hệ mới. Linh hoạt chọn giờ, tự động tính giá và Check-in tự động 100%.</p>
      </div>

      <Card className="border-0 shadow-sm bg-white overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b pb-4">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <CardTitle>Bảng Giá Biến Động</CardTitle>
              <CardDescription className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1.5 whitespace-nowrap"><div className="w-2 h-2 rounded-full bg-emerald-500"></div>Sáng: 100k/h</span>
                <span className="flex items-center gap-1.5 whitespace-nowrap"><div className="w-2 h-2 rounded-full bg-amber-400"></div>Chiều: 80k/h</span>
                <span className="flex items-center gap-1.5 whitespace-nowrap"><div className="w-2 h-2 rounded-full bg-slate-900"></div>Tối: 150k/h</span>
              </CardDescription>
            </div>
            <div className="w-full sm:w-[250px]">
              <Select value={selectedCourt} onValueChange={setSelectedCourt}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Chọn một sân" />
                </SelectTrigger>
                <SelectContent>
                  {courts.map(court => (
                    <SelectItem key={court.id} value={court.id}>{court.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6 space-y-8">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center">
              1. Chọn Ngày Chơi
            </h3>
            <div className="flex space-x-3 overflow-x-auto pb-4 scrollbar-hide py-2 px-1">
              {next7Days.map((date) => {
                const isSelected = isSameDay(date, selectedDate);
                const { hasMorning, hasAfternoon, hasEvening } = getDayStatus(date);
                
                return (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    key={date.toString()}
                    onClick={() => {
                      setSelectedDate(date);
                      setSelectedHours([]);
                    }}
                    className={`flex flex-col items-center justify-between min-w-[80px] h-[110px] rounded-2xl border-2 transition-all duration-300 overflow-hidden relative cursor-pointer shadow-sm
                      ${isSelected ? 'border-orange-500 bg-orange-50/30 ring-4 ring-orange-500/20' : 'border-slate-200 bg-white hover:border-orange-300'}`}
                  >
                    <div className="pt-3 pb-1 text-center w-full z-10 bg-white/50 backdrop-blur-sm">
                      <span className="block text-xs font-medium text-slate-500 capitalize">
                        {format(date, 'EEEE', { locale: vi }).replace('thứ', 'Thứ').replace('chủ nhật', 'Chủ nhật')}
                      </span>
                      <span className={`block text-2xl font-bold mt-1 ${isSelected ? 'text-orange-600' : 'text-slate-800'}`}>
                        {format(date, 'dd')}
                      </span>
                    </div>
                    <div className="flex w-full h-[6px] mt-auto">
                       <div className={`w-1/3 h-full transition-colors ${hasMorning ? 'bg-emerald-500' : 'bg-slate-200'}`} title="Sáng có người"></div>
                       <div className={`w-1/3 h-full transition-colors ${hasAfternoon ? 'bg-amber-400' : 'bg-slate-200'}`} title="Chiều có người"></div>
                       <div className={`w-1/3 h-full transition-colors ${hasEvening ? 'bg-slate-900' : 'bg-slate-200'}`}title="Tối có người"></div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="h-[1px] w-full bg-slate-100"></div>

          <div className="space-y-4">
             <div className="flex justify-between items-end mb-4">
               <div>
                  <h3 className="text-lg font-semibold flex items-center">
                    2. Chọn Khoảng Thời Gian
                  </h3>
                  <p className="text-sm text-slate-500 flex items-center gap-1 mt-1"><Info className="w-4 h-4"/> Có thể chọn nhiều khung giờ liên tiếp</p>
               </div>
               {selectedHours.length > 0 && (
                 <span className="text-sm font-medium animate-pulse text-indigo-600 font-mono bg-indigo-50 px-2 py-1 rounded">Đã chọn {selectedHours.length} giờ</span>
               )}
             </div>

             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <AnimatePresence mode="popLayout">
                  {Array.from({ length: 18 }).map((_, i) => {
                    const hour = i + 6; 
                    const isBooked = bookedSlots.some(b => b.date === format(selectedDate, 'yyyy-MM-dd') && b.hour === hour);
                    const isSelected = selectedHours.includes(hour);
                    const price = getPricePerHour(hour);

                    let statusClass = "";
                    let priceColor = "";
                    let indicatorText = "";

                    if (isBooked) {
                       statusClass = "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60";
                       priceColor = "text-slate-300";
                       indicatorText = "Đã Đặt";
                    } else if (isSelected) {
                       statusClass = "bg-gradient-to-br from-orange-500 to-orange-600 border-orange-500 text-white shadow-lg shadow-orange-500/30 transform scale-105 z-10 ring-2 ring-orange-500/50 ring-offset-1";
                       priceColor = "text-orange-100";
                       indicatorText = "Đang chọn";
                    } else {
                       if (hour < 12) {
                         statusClass = "bg-emerald-50/40 border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50 text-emerald-900";
                         priceColor = "text-emerald-600";
                       } else if (hour < 17) {
                         statusClass = "bg-amber-50/40 border-amber-100 hover:border-amber-300 hover:bg-amber-50 text-amber-900";
                         priceColor = "text-amber-600";
                       } else {
                         statusClass = "bg-slate-50/40 border-slate-200 hover:border-slate-400 hover:bg-slate-100 text-slate-900";
                         priceColor = "text-slate-700 font-bold";
                       }
                       indicatorText = "Trống";
                    }

                    return (
                      <motion.button
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.02 }}
                        key={hour}
                        disabled={isBooked}
                        onClick={() => handleHourClick(hour)}
                        className={`relative h-[70px] rounded-xl border-2 transition-all flex flex-col px-3 justify-center text-left ${statusClass}`}
                      >
                         <div className="flex justify-between items-center w-full">
                           <span className="text-base font-bold">{hour}:00 - {hour + 1}:00</span>
                         </div>
                         
                         <div className="flex justify-between items-center w-full mt-1">
                            <span className={`text-sm font-medium ${priceColor}`}>{(price/1000).toFixed(0)}k</span>
                            {isBooked ? (
                               <span className="text-[10px] uppercase font-bold text-slate-400 bg-white/60 px-2 py-0.5 rounded-md shadow-sm">Kín</span>
                            ) : isSelected ? (
                               <span className="text-[10px] uppercase font-bold text-orange-600 bg-white px-2 py-0.5 rounded-md shadow-sm">{indicatorText}</span>
                            ) : (
                               <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-white/60 shadow-sm ${priceColor}`}>{indicatorText}</span>
                            )}
                         </div>
                      </motion.button>
                    )
                  })}
                </AnimatePresence>
             </div>
          </div>

          <div className="h-[1px] w-full bg-slate-100 mt-6 mb-2"></div>

          <div className="space-y-4 pb-4">
             <h3 className="text-lg font-semibold flex items-center text-slate-800">
               3. Thông Tin Liên Hệ
             </h3>
             <div className="max-w-sm">
                <Input 
                   placeholder="Nhập số điện thoại của bạn (VD: 0912345678)" 
                   value={customerPhone}
                   onChange={(e) => setCustomerPhone(e.target.value)}
                   className="bg-slate-50 border-slate-200 h-12 text-md transition-shadow focus-visible:ring-emerald-500"
                   type="tel"
                />
             </div>
          </div>
        </CardContent>
      </Card>

      <AnimatePresence>
        {selectedHours.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-2xl bg-slate-900 border border-slate-700 text-white rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col sm:flex-row"
          >
            <div className="flex-1 p-4 px-6 flex flex-col justify-center">
              <div className="flex justify-between items-baseline mb-1">
                 <p className="text-sm text-slate-400">Tổng thanh toán ({selectedHours.length} giờ)</p>
                 <p className="text-2xl font-bold text-orange-400">{calculateTotal().toLocaleString('vi-VN')}đ</p>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                 {getSelectedRanges().map((r, idx) => (
                    <span key={idx} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded-md border border-slate-700">
                      {r.start}:00 - {r.end}:00
                    </span>
                 ))}
              </div>
            </div>
            <div className="p-4 sm:p-2 sm:pr-2 flex items-center justify-center bg-slate-800/50 sm:bg-transparent border-t border-slate-800 sm:border-0">
               <Button 
                onClick={handleBooking} 
                disabled={loading}
                className="w-full sm:w-auto h-12 bg-orange-500 hover:bg-orange-600 text-white shadow-lg px-8 rounded-xl text-md font-semibold transition-all hover:scale-105 active:scale-95"
               >
                {loading ? 'Xử lý...' : 'Xác nhận Đặt sân'}
               </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showQR} onOpenChange={(open) => {
        setShowQR(open);
        if (!open) {
          setReceiptData(null);
        }
      }}>
        <DialogContent className="sm:max-w-md flex flex-col items-center justify-center p-6 bg-slate-900 border-slate-800 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center text-white text-2xl font-bold">Hoàn Tất Đặt Sân</DialogTitle>
            <DialogDescription className="text-center text-slate-400">
              Vui lòng thanh toán và lưu lại mã QR check-in.
            </DialogDescription>
          </DialogHeader>
          
          <div className="w-full space-y-4 mt-2">
            {/* Payment Section */}
            <div className="flex flex-col items-center bg-slate-800 p-4 rounded-2xl border border-slate-700 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-2 opacity-10">
                 <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.64-2.25 1.64-1.74 0-2.33-.97-2.39-1.8H7.81c.07 1.64 1.25 2.84 3.09 3.26V19h2.32v-1.7c1.61-.31 2.88-1.38 2.88-3.03 0-2.3-1.83-3.13-3.79-3.63z" /></svg>
               </div>
               <h4 className="text-orange-400 font-semibold mb-3 z-10">1. Quét Mã Thanh Toán</h4>
               <div className="bg-white p-2 rounded-xl border-2 border-slate-600 z-10 flex flex-col items-center">
                 {/* Fixed space in filename based on actual public dir contents */}
                 <img src="/qrthanhtoan .jpg" alt="QR Thanh Toán" className="w-[180px] h-auto rounded-lg" />
                 <a 
                   href="/qrthanhtoan .jpg" 
                   download="QR_ThanhToan_CourtKings.jpg" 
                   className="mt-2 text-xs flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-md font-medium transition-colors w-full"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    Tải ảnh xuống
                 </a>
               </div>
               <div className="mt-4 w-full text-center z-10 bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                 <p className="text-sm text-slate-300 flex justify-between items-center mb-2">Số tiền: <span className="font-bold text-orange-400 text-xl ml-1">{receiptData?.total.toLocaleString('vi-VN')}đ</span></p>
                 <div className="w-full h-px bg-slate-700/50 mb-2"></div>
                 <p className="text-xs text-slate-400 flex flex-col items-start gap-1">
                    <span className="mb-0.5">Vui lòng nhập chính xác Nội dung DK:</span>
                    <span className="text-white font-mono bg-slate-800 px-3 py-1.5 rounded w-full text-left tracking-wider">
                      {receiptData?.phone} CHON {receiptData?.ranges.length} CA
                    </span>
                 </p>
               </div>
            </div>

            {/* Check-in Instructions Section */}
            <div className="flex flex-col items-center bg-emerald-900/30 p-4 rounded-2xl border border-emerald-800/50">
              <h4 className="text-emerald-400 font-semibold mb-2">2. Hướng dẫn Mở Cửa</h4>
              <p className="text-sm text-slate-300 text-center mb-4">Khi đến sân, nhấn nút tại cửa để lấy mã, sau đó dùng tính năng Quét Mã của App để mở cửa điện.</p>
              <Button 
                onClick={() => {
                  setShowQR(false);
                  window.location.hash = '#/checkin';
                }} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white w-full rounded-xl"
              >
                Mở Camera Quét Mã Tại Sân
              </Button>
            </div>
          </div>
          
          <div className="mt-4 w-full space-y-2 text-center text-sm font-medium text-slate-300 bg-slate-800/50 p-4 rounded-xl">
             <p className="flex justify-between border-b border-slate-700 pb-2"><span>Ngày đặt:</span> <span className="text-white">{receiptData?.date ? format(receiptData.date, 'dd/MM/yyyy') : ''}</span></p>
             <div className="flex justify-between text-left"><span>Giờ chơi:</span> <span className="text-orange-400 font-bold text-right flex flex-col items-end">
               {receiptData?.ranges.map((r, idx) => (
                 <span key={idx}>{r.start}:00 - {r.end}:00</span>
               ))}
             </span></div>
          </div>
          <Button onClick={() => setShowQR(false)} className="mt-4 w-full bg-slate-700 hover:bg-slate-600 text-white">Đóng Biên Lai</Button>
        </DialogContent>
      </Dialog>
      
      <style>{`
        .striped-bg {
          background-image: repeating-linear-gradient(45deg, rgba(0, 0, 0, 0.03), rgba(0, 0, 0, 0.03) 10px, rgba(0, 0, 0, 0) 10px, rgba(0, 0, 0, 0) 20px);
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};
