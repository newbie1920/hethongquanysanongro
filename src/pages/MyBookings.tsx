import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { getBookingsByUser, SavedBooking } from '../lib/bookingStore';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog';
import { format } from 'date-fns';
import { Receipt, QrCode, Clock, CheckCircle2, RefreshCw } from 'lucide-react';

// === CẤU HÌNH TÀI KHOẢN TIMO CỦA BẠN ===
const TIMO_ACCOUNT_NO   = '9021164715496';  // Số TK Timo
const TIMO_ACCOUNT_NAME = 'LE MINH DAT';    // Tên chủ TK (không dấu)
const TIMO_BANK_BIN     = '970454';          // BIN BVBank (Timo)

function buildVietQrUrl(amount: number, content: string) {
  // Dùng API VietQR public (https://img.vietqr.io)
  const base = 'https://img.vietqr.io/image';
  const params = new URLSearchParams({
    amount: String(amount),
    addInfo: content,
    accountName: TIMO_ACCOUNT_NAME,
  });
  return `${base}/${TIMO_BANK_BIN}-${TIMO_ACCOUNT_NO}-compact2.png?${params}`;
}

export const MyBookings = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<SavedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<SavedBooking | null>(null);

  useEffect(() => {
    if (user) fetchBookings();
  }, [user]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const data = await getBookingsByUser(user!.id);
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBookings(data);
    } finally {
      setLoading(false);
    }
  };

  const openPayment = (b: SavedBooking) => {
    setSelectedBooking(b);
    setShowPaymentModal(true);
  };

  const getStatusInfo = (b: SavedBooking) => {
    if (b.paid) return {
      label: 'Đã thanh toán',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      className: 'bg-emerald-500 hover:bg-emerald-600 text-white',
    };
    return {
      label: 'Chờ xác nhận',
      icon: <Clock className="w-3.5 h-3.5" />,
      className: 'bg-orange-500 hover:bg-orange-600 text-white',
    };
  };

  if (loading) return (
    <div className="flex items-center justify-center p-16 text-slate-400">
      <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Đang tải...
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-2 pb-10">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Đơn Hàng Của Tôi</h1>
          <p className="text-slate-500">Lịch sử đặt sân và trạng thái thanh toán.</p>
        </div>
        <Button onClick={fetchBookings} variant="outline" size="sm" className="gap-1.5">
          <RefreshCw className="w-4 h-4" /> Làm mới
        </Button>
      </div>

      {bookings.length === 0 ? (
        <Card className="bg-slate-50 border-dashed border-2 border-slate-200">
          <CardContent className="flex flex-col items-center justify-center p-12 text-slate-400">
            <Receipt className="w-12 h-12 mb-4 text-slate-300" />
            <p className="text-lg font-medium">Bạn chưa có đơn đặt sân nào</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {bookings.map((b) => {
            const status = getStatusInfo(b);
            return (
              <Card key={b.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row">
                  {/* Thông tin chính */}
                  <div className="flex-1 p-5 lg:p-6">
                    <div className="flex justify-between items-start mb-4 gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">{b.courtName}</h3>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{b.id}</p>
                      </div>
                      <Badge className={status.className + ' flex items-center gap-1 shrink-0'}>
                        {status.icon} {status.label}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-y-3 text-sm">
                      <div>
                        <p className="text-slate-400 text-xs mb-0.5">Ngày chơi</p>
                        <p className="font-semibold">{format(new Date(b.date + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs mb-0.5">Khung giờ</p>
                        <p className="font-semibold text-blue-600">
                          {b.ranges.map(r => `${r.start}:00–${r.end}:00`).join(', ')}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs mb-0.5">Người đặt</p>
                        <p className="font-semibold">{b.customerName} · {b.customerPhone}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs mb-0.5">Đặt lúc</p>
                        <p className="font-semibold text-slate-500">{new Date(b.createdAt).toLocaleString('vi-VN')}</p>
                      </div>
                    </div>

                    {/* Hướng dẫn trạng thái */}
                    {!b.paid && (
                      <div className="mt-4 p-3 bg-orange-50 border border-orange-100 rounded-xl text-xs text-orange-700 leading-relaxed">
                        ⏳ <strong>Đơn của bạn đang chờ thanh toán.</strong> Bấm "Thanh toán Timo" để chuyển tiền,
                        hoặc Admin sẽ xác nhận thủ công. Sau khi được duyệt, bạn có thể dùng tính năng Quét Mã Mở Cửa.
                      </div>
                    )}
                    {b.paid && (
                      <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700">
                        ✅ <strong>Đã được xác nhận!</strong> Đến sân đúng giờ, vào tab <strong>Quét Mã Mở Cửa</strong> để check-in.
                      </div>
                    )}
                  </div>

                  {/* Phần thanh toán */}
                  <div className="bg-slate-50 border-t md:border-t-0 md:border-l border-slate-100 p-5 md:w-56 flex flex-col justify-center items-center text-center gap-3">
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Tổng cộng</p>
                      <p className="text-2xl font-bold text-orange-500">{b.total.toLocaleString('vi-VN')}đ</p>
                    </div>

                    {!b.paid ? (
                      <Button
                        onClick={() => openPayment(b)}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow gap-1.5"
                      >
                        <QrCode className="w-4 h-4" /> Thanh toán Timo
                      </Button>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="w-8 h-8" />
                        <p className="text-xs font-semibold">Sẵn sàng Check-in</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal QR Timo */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm p-0 overflow-hidden rounded-2xl">
          <DialogTitle className="sr-only">Thanh toán qua Timo</DialogTitle>
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white text-center">
            <h2 className="text-xl font-bold">Thanh toán qua Timo</h2>
            <p className="text-slate-400 text-sm mt-1">Quét bằng bất kỳ app ngân hàng / ví</p>
          </div>

          <div className="p-5 space-y-4 flex flex-col items-center">
            {/* VietQR động */}
            {selectedBooking && (
              <div className="border-4 border-slate-100 rounded-2xl p-2 shadow-inner">
                <img
                  src={buildVietQrUrl(selectedBooking.total, selectedBooking.id)}
                  alt="QR Thanh Toán Timo"
                  className="w-52 h-52 object-contain rounded-xl"
                  onError={(e) => {
                    // Fallback nếu chưa cấu hình TK: dùng ảnh tĩnh cũ
                    (e.target as HTMLImageElement).src = '/qrthanhtoan .jpg';
                  }}
                />
              </div>
            )}

            {/* Thông tin thanh toán */}
            <div className="w-full bg-slate-50 rounded-xl p-4 text-sm space-y-2 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">Ngân hàng</span>
                <span className="font-bold">Timo (BVBank)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Số tiền</span>
                <span className="font-bold text-orange-600 text-base">
                  {selectedBooking?.total.toLocaleString('vi-VN')} VND
                </span>
              </div>
              <div className="border-t border-slate-200 pt-2">
                <p className="text-slate-500 mb-1">Nội dung <strong className="text-red-500">(BẮT BUỘC)</strong></p>
                <div className="bg-slate-900 text-green-400 font-mono text-xs p-2 rounded-lg overflow-x-auto whitespace-nowrap tracking-wider">
                  {selectedBooking?.id}
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-400 text-center leading-relaxed">
              Sau khi chuyển khoản, Admin sẽ xác nhận và trạng thái đơn sẽ chuyển sang <strong>Đã thanh toán</strong>.
            </p>

            <Button onClick={() => setShowPaymentModal(false)} className="w-full bg-slate-900 text-white rounded-xl">
              Đã chuyển khoản, Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
