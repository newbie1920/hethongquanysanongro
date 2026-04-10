import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Lightbulb, Fan, DoorOpen, Users, Clock, MapPin, ChevronRight, ArrowLeft, ShieldX, CalendarDays } from 'lucide-react';
import { publishMessage, mqttClient } from '../lib/mqtt';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { useAuth } from '../lib/AuthContext';
import { getPaidBookingsByUserToday, getAllPaidBookingsToday, SavedBooking } from '../lib/bookingStore';
import { useNavigate } from 'react-router-dom';

export const Control = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [myBookings, setMyBookings] = useState<SavedBooking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<SavedBooking | null>(null);
  const [lightStatus, setLightStatus] = useState(false);
  const [fanStatus, setFanStatus] = useState(false);
  const [doorStatus, setDoorStatus] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Load bookings: User sees their own, Admin sees all
  useEffect(() => {
    const fetchBookings = async () => {
      if (role === 'admin') {
        const bookings = await getAllPaidBookingsToday();
        setMyBookings(bookings);
      } else if (user?.id) {
        const bookings = await getPaidBookingsByUserToday(user.id);
        setMyBookings(bookings);
      }
    };
    fetchBookings();
  }, [user, role]);

  useEffect(() => {
    setIsConnected(mqttClient.connected);
    
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    
    mqttClient.on('connect', handleConnect);
    mqttClient.on('close', handleDisconnect);
    mqttClient.on('offline', handleDisconnect);

    return () => {
      mqttClient.off('connect', handleConnect);
      mqttClient.off('close', handleDisconnect);
      mqttClient.off('offline', handleDisconnect);
    };
  }, []);

  const handleSelectBooking = (booking: SavedBooking) => {
    setSelectedBooking(booking);
    setLightStatus(false);
    setFanStatus(false);
    setDoorStatus(false);
  };

  const handleToggleLight = (checked: boolean) => {
    if (!selectedBooking) return;
    setLightStatus(checked);
    publishMessage(`court/${selectedBooking.courtId}/light`, checked ? 'ON' : 'OFF');
    toast.success(`Đèn ${selectedBooking.courtName} đã ${checked ? 'BẬT' : 'TẮT'}`);
  };

  const handleToggleFan = (checked: boolean) => {
    if (!selectedBooking) return;
    setFanStatus(checked);
    publishMessage(`court/${selectedBooking.courtId}/fan`, checked ? 'ON' : 'OFF');
    toast.success(`Quạt ${selectedBooking.courtName} đã ${checked ? 'BẬT' : 'TẮT'}`);
  };

  const handleToggleDoor = (checked: boolean) => {
    if (!selectedBooking) return;
    setDoorStatus(checked);
    publishMessage(`court/${selectedBooking.courtId}/open`, checked ? 'OPEN' : 'CLOSE');
    toast.success(`Cửa ${selectedBooking.courtName} đã ${checked ? 'MỞ' : 'ĐÓNG'}`);
  };

  // Kiểm tra giờ hiện tại có nằm trong khung giờ đặt không
  const isWithinTimeSlot = (booking: SavedBooking) => {
    const now = new Date();
    const currentHour = now.getHours();
    return booking.ranges.some(r => currentHour >= r.start && currentHour < r.end);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          {selectedBooking ? (
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setSelectedBooking(null)}
                className="text-slate-400 hover:text-white hover:bg-white/10 rounded-xl"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-white">
                  Điều khiển {selectedBooking.courtName}
                </h1>
                <p className="text-slate-500">
                  Tài khoản: <span className="text-orange-400 font-medium">{selectedBooking.userEmail}</span> — 
                  Khung giờ: {selectedBooking.ranges.map(r => `${r.start}:00-${r.end}:00`).join(', ')}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Điều Khiển Sân</h1>
              <p className="text-slate-500">Chỉ hiển thị phòng bạn đã đặt và thanh toán hôm nay.</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-sm text-slate-400 font-medium">
            MQTT {isConnected ? 'Đã kết nối' : 'Mất kết nối'}
          </span>
        </div>
      </div>

      {/* ========== CHỌN BOOKING CỦA TÔI ========== */}
      {!selectedBooking ? (
        <div className="space-y-4">
          {myBookings.length > 0 ? (
            <>
              <h2 className="text-lg font-semibold text-slate-300 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-orange-400" />
                Phòng Của Bạn Hôm Nay ({myBookings.length})
              </h2>
              <div className="grid gap-4">
                {myBookings.map((booking) => {
                  const isActive = isWithinTimeSlot(booking);
                  return (
                    <button
                      key={booking.id}
                      onClick={() => handleSelectBooking(booking)}
                      className={`w-full text-left rounded-2xl border p-5 transition-all group ${
                        isActive 
                          ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-400/50'
                          : 'border-white/10 bg-white/5 hover:border-orange-500/40 hover:bg-orange-500/5'
                      } cursor-pointer`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="font-bold text-white text-lg group-hover:text-orange-400 transition-colors">
                              {booking.courtName}
                            </h3>
                            {isActive ? (
                              <span className="px-2.5 py-1 text-[11px] font-bold uppercase rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Đang trong giờ
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 text-[11px] font-bold uppercase rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                                Sắp tới
                              </span>
                            )}
                            <span className="px-2.5 py-1 text-[11px] font-bold uppercase rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-600/30">
                              ✓ Đã thanh toán
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                            <div className="flex items-center gap-2 text-slate-400">
                              <Clock className="h-4 w-4 text-slate-500" />
                              <span className="font-medium text-slate-300">
                                {booking.ranges.map(r => `${r.start}:00 - ${r.end}:00`).join(', ')}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400">
                              <span className="text-xs">📞</span>
                              <span>{booking.customerPhone}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400">
                              <span className="text-xs">💰</span>
                              <span className="text-orange-400 font-bold">{booking.total.toLocaleString('vi-VN')}đ</span>
                            </div>
                          </div>
                        </div>
                        
                        <ChevronRight className="h-6 w-6 text-slate-600 group-hover:text-orange-400 transition-colors mt-2" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            /* Chưa đặt phòng nào */
            <div className="text-center py-20">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-800/50 flex items-center justify-center">
                <ShieldX className="h-10 w-10 text-slate-600" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Bạn chưa có phòng nào hôm nay</h2>
              <p className="text-slate-500 max-w-md mx-auto mb-6">
                Bạn cần đặt sân và thanh toán trước, sau đó mới có thể điều khiển thiết bị (đèn, quạt, cửa) của phòng đã đặt.
              </p>
              <Button 
                onClick={() => navigate('/booking')}
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-xl font-semibold"
              >
                🏀 Đặt Sân Ngay
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* ========== ĐIỀU KHIỂN PHÒNG ĐÃ CHỌN ========== */
        <div className="space-y-6">
          {/* Thông tin booking */}
          <Card className="border-white/10 bg-white/5 border-0">
            <CardContent className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 mb-1">Tài khoản</p>
                  <p className="text-white font-semibold truncate">{selectedBooking.userEmail}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Số điện thoại</p>
                  <p className="text-white font-semibold">{selectedBooking.customerPhone}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Khung giờ</p>
                  <p className="text-orange-400 font-semibold">
                    {selectedBooking.ranges.map(r => `${r.start}:00-${r.end}:00`).join(', ')}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Thanh toán</p>
                  <span className="px-2.5 py-1 text-[11px] font-bold uppercase rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-600/30">
                    ✓ {selectedBooking.total.toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Điều khiển thiết bị */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-white/10 bg-white/5 border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${lightStatus ? 'bg-yellow-500/20' : 'bg-white/5'}`}>
                    <Lightbulb className={`h-5 w-5 ${lightStatus ? "text-yellow-400" : "text-slate-500"}`} />
                  </div>
                  Hệ thống Đèn
                </CardTitle>
                <CardDescription className="text-slate-500">Đèn chiếu sáng {selectedBooking.courtName}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <Label htmlFor="light-switch" className={`text-lg font-bold ${lightStatus ? 'text-yellow-400' : 'text-slate-500'}`}>
                  {lightStatus ? 'BẬT' : 'TẮT'}
                </Label>
                <Switch 
                  id="light-switch" 
                  checked={lightStatus} 
                  onCheckedChange={handleToggleLight} 
                />
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/5 border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${fanStatus ? 'bg-blue-500/20' : 'bg-white/5'}`}>
                    <Fan className={`h-5 w-5 ${fanStatus ? "text-blue-400 animate-spin" : "text-slate-500"}`} style={fanStatus ? { animationDuration: '1.5s' } : {}} />
                  </div>
                  Quạt thông gió
                </CardTitle>
                <CardDescription className="text-slate-500">Quạt làm mát {selectedBooking.courtName}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <Label htmlFor="fan-switch" className={`text-lg font-bold ${fanStatus ? 'text-blue-400' : 'text-slate-500'}`}>
                  {fanStatus ? 'BẬT' : 'TẮT'}
                </Label>
                <Switch 
                  id="fan-switch" 
                  checked={fanStatus} 
                  onCheckedChange={handleToggleFan} 
                />
              </CardContent>
            </Card>

            <Card className="md:col-span-2 border-white/10 bg-white/5 border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${doorStatus ? 'bg-emerald-500/20' : 'bg-white/5'}`}>
                    <DoorOpen className={`h-5 w-5 ${doorStatus ? "text-emerald-400" : "text-slate-500"}`} />
                  </div>
                  Cửa ra vào
                </CardTitle>
                <CardDescription className="text-slate-500">Khóa servo — {selectedBooking.courtName}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <Label htmlFor="door-switch" className={`text-lg font-bold ${doorStatus ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {doorStatus ? 'MỞ KHÓA (MỞ)' : 'ĐÃ KHÓA (ĐÓNG)'}
                </Label>
                <Switch 
                  id="door-switch" 
                  checked={doorStatus} 
                  onCheckedChange={handleToggleDoor} 
                />
              </CardContent>
            </Card>
          </div>

          {/* MQTT Topic info */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-xs text-slate-500 font-mono mb-2">MQTT Topics cho {selectedBooking.courtName}:</p>
            <div className="flex flex-wrap gap-2">
              <code className="text-[11px] bg-slate-800 text-orange-400 px-2 py-1 rounded">court/{selectedBooking.courtId}/light</code>
              <code className="text-[11px] bg-slate-800 text-blue-400 px-2 py-1 rounded">court/{selectedBooking.courtId}/fan</code>
              <code className="text-[11px] bg-slate-800 text-emerald-400 px-2 py-1 rounded">court/{selectedBooking.courtId}/open</code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
