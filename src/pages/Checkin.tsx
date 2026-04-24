import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Scanner } from '@yudiel/react-qr-scanner';
import { toast } from 'sonner';
import { CheckCircle2, QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { getPaidBookingsByUserToday } from '../lib/bookingStore';

export const Checkin = () => {
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleScan = async (text: string) => {
    if (scanned || loading) return;
    
    if (!user) {
      toast.error('Bạn cần đăng nhập để thao tác!');
      return;
    }

    setLoading(true);
    
    // Format expected from ESP32: "COURT01_1234"
    if (text.startsWith('COURT_') || text.startsWith('COURT01')) {
      
      try {
        // Kiểm tra xem khách có sân nào đã thanh toán trong ngày không
        const myPaidBookings = await getPaidBookingsByUserToday(user.id);
        
        if (myPaidBookings.length === 0) {
          toast.error('Bạn không có lịch đặt sân nào đã thanh toán để sử dụng hôm nay!');
          setLoading(false);
          return;
        }

        // Lấy giờ hiện tại để đối chiếu
        const currentHour = new Date().getHours();
        
        // Lấy lịch đặt của khung giờ hiện tại
        const currentBooking = myPaidBookings.find(booking => 
          booking.ranges.some(r => currentHour >= r.start && currentHour < r.end)
        );

        if (!currentBooking) {
          toast.error(`Bạn có lịch đặt nhưng KHÔNG phải khung giờ hiện tại (${currentHour}h)!`);
          setLoading(false);
          return;
        }

        const { publishMessage } = await import('../lib/mqtt');
        
        // Gửi lệnh mở cửa tương ứng với sân đã đặt
        publishMessage(`court/${currentBooking.court_id}/open`, 'OPEN');
        
        // Tắt đèn & quạt tự động mở theo sân (nếu phần cứng hỗ trợ)
        publishMessage(`court/${currentBooking.court_id}/light`, 'ON');
      } catch (e) {
        console.warn('Network / MQTT / Database error', e);
        toast.error('Lỗi khi đối chiếu thông tin (Cần mạng để hoạt động)');
        setLoading(false);
        return;
      }

      toast.success('Xác thực thành công. Đã mở cửa và bật đèn!');
      setScanned(true);
      
      // Navigate or show success
      setTimeout(() => {
        navigate('/control'); // After opening door, go to control panel
      }, 2000);
    } else {
      toast.error('Mã QR không hợp lệ. Vui lòng quét mã trên màn hình tại sân!');
    }
    
    setLoading(false);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Check-in Mở Cửa</h1>
        <p className="text-slate-500">Quét mã QR trên màn hình tại cổng sân để kích hoạt giờ chơi.</p>
      </div>

      <Card className="overflow-hidden border-orange-200">
        <CardHeader className="bg-orange-50 border-b border-orange-100">
          <CardTitle className="flex items-center gap-2 text-orange-800">
            <QrCode className="h-5 w-5" />
            Scanner Camera
          </CardTitle>
          <CardDescription>Đưa camera điện thoại về phía mã QR đang hiển thị trên màn hình TFT.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {scanned ? (
            <div className="flex flex-col items-center justify-center p-8 space-y-4 text-emerald-600 bg-emerald-50 rounded-2xl">
              <CheckCircle2 className="w-20 h-20" />
              <h2 className="text-2xl font-bold">Mở cửa thành công!</h2>
              <p className="text-emerald-700 text-center">
                Hệ thống đang mở Servo cửa và kích hoạt hệ thống điện cho sân của bạn.
              </p>
              <Button onClick={() => navigate('/control')} className="mt-4 bg-emerald-600 hover:bg-emerald-700">
                Chuyển đến Bảng Điều Khiển
              </Button>
            </div>
          ) : (
            <div className="w-full bg-slate-900 rounded-2xl overflow-hidden aspect-square sm:aspect-video relative ring-4 ring-orange-500/20">
              <Scanner
                onScan={(result) => {
                  if (result && result.length > 0) {
                    handleScan(result[0].rawValue);
                  }
                }}
                onError={(error) => {
                  console.error(error);
                  if (error.message.includes('permission') || error.message.includes('allowed')) {
                    toast.error('Lỗi: Trình duyệt từ chối quyền bật Camera! Hãy đảm bảo web đang chạy bằng giao thức HTTPS hoặc cấp quyền trong cài đặt.');
                  } else {
                    toast.error('Lỗi Camera: ' + error.message);
                  }
                }}
                components={{
                  tracker: true,
                  audio: true,
                }}
              />
              <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none"></div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <div className="w-48 h-48 sm:w-64 sm:h-64 border-2 border-orange-500 border-dashed rounded-3xl"></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="text-center text-sm text-slate-500">
        Hãy đảm bảo bạn đã cấp quyền cho phép trình duyệt sử dụng Camera.
      </div>
    </div>
  );
};
