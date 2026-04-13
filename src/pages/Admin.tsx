import React, { useState, useEffect } from 'react';
import { supabase, Court } from '../lib/supabase';
import { getBookings, markBookingPaid, markBookingUnpaid, deleteBooking, SavedBooking } from '../lib/bookingStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { Lock, CheckCircle2, XCircle, Trash2 } from 'lucide-react';

const ADMIN_PIN = '8888'; // Anh có thể đổi mã PIN ở đây

export const Admin = () => {
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<SavedBooking[]>([]);
  const [newCourtName, setNewCourtName] = useState('');
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (isAuthorized) {
      fetchCourts();
      fetchAllBookings();
    }
  }, [isAuthorized]);

  const fetchAllBookings = async () => {
    try {
      const data = await getBookings();
      // Sort to show pending first, then by date newer
      data.sort((a, b) => {
        if (a.paid === b.paid) {
           return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return a.paid ? 1 : -1;
      });
      setBookings(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await markBookingPaid(id);
      toast.success('✅ Đã duyệt - Khách có thể Check-in!');
      fetchAllBookings();
    } catch (err) {
      toast.error('Lỗi khi duyệt đơn!');
    }
  };

  const handleUnapprove = async (id: string) => {
    try {
      await markBookingUnpaid(id);
      toast.warning('↩️ Đã hủy duyệt - Đơn trở về trạng thái chờ thanh toán.');
      fetchAllBookings();
    } catch (err) {
      toast.error('Lỗi khi hủy duyệt!');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Xóa vĩnh viễn đơn này? Hành động không thể hoàn tác!")) {
      try {
        await deleteBooking(id);
        toast.success('🗑️ Đã xóa đơn!');
        fetchAllBookings();
      } catch (err: any) {
        toast.error('Lỗi khi xóa. Hãy kiểm tra RLS Policy trên Supabase.');
      }
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      setIsAuthorized(true);
      toast.success('Xác thực thành công');
    } else {
      toast.error('Mã PIN không chính xác');
      setPin('');
    }
  };

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-sm border-2 border-slate-200">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <Lock className="text-orange-600" size={24} />
            </div>
            <CardTitle>Xác thực Quản trị viên</CardTitle>
            <p className="text-sm text-slate-500">Vui lòng nhập mã PIN lớp 2 để tiếp tục</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <Input
                type="password"
                placeholder="Nhập mã PIN..."
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="text-center text-2xl tracking-[1em]"
                maxLength={4}
                autoFocus
              />
              <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800">
                Xác nhận
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fetchCourts = async () => {
    try {
      const { data, error } = await supabase.from('courts').select('*');
      if (error) throw error;
      setCourts(data || []);
    } catch (error) {
      // Mock data
      setCourts([
        { id: '1', name: 'Sân A - Trong nhà', status: 'available' },
        { id: '2', name: 'Sân B - Ngoài trời', status: 'in_use' },
      ]);
    }
  };

  const handleCreateCourt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourtName) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('courts')
        .insert([{ name: newCourtName, status: 'available' }]);
      
      if (error) throw error;
      
      toast.success('Tạo sân thành công');
      setNewCourtName('');
      fetchCourts();
    } catch (error: any) {
      toast.error('Không thể tạo sân (Chế độ mô phỏng)');
      // Mock update
      setCourts([...courts, { id: Date.now().toString(), name: newCourtName, status: 'available' }]);
      setNewCourtName('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bảng Quản trị</h1>
        <p className="text-slate-500">Quản lý sân và xem nhật ký hệ thống.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Thêm sân mới</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateCourt} className="space-y-4">
              <div className="space-y-2">
                <Input 
                  placeholder="Tên sân" 
                  value={newCourtName}
                  onChange={(e) => setNewCourtName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                Tạo sân
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Quản lý danh sách sân</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Tên</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courts.map((court) => (
                  <TableRow key={court.id}>
                    <TableCell className="font-medium">{court.id.slice(0, 8)}</TableCell>
                    <TableCell>{court.name}</TableCell>
                    <TableCell>
                      <Badge variant={court.status === 'available' ? 'default' : 'secondary'}>
                        {court.status === 'available' ? 'Trống' : court.status === 'in_use' ? 'Đang sử dụng' : 'Bảo trì'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm">Sửa</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quản lý Đơn Đặt Sân</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead>Sân & Giờ</TableHead>
                  <TableHead>Tổng tiền</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {new Date(b.createdAt).toLocaleDateString('vi-VN')} <br/>
                      <span className="text-xs text-slate-400">{new Date(b.createdAt).toLocaleTimeString('vi-VN')}</span>
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-slate-800 text-base">{b.customerName || 'Tên: (Chưa cập nhật)'}</div>
                      <div className="text-sm font-semibold text-slate-600 mt-0.5">SĐT: {b.customerPhone || '(Trống)'}</div>
                      <div className="text-xs text-blue-600 mt-1">Email: {b.userEmail}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{b.courtName}</div>
                      <div className="text-sm text-slate-500">
                        Ngày: {b.date} <br/>
                        Giờ: {b.ranges.map(r => `${r.start}:00 - ${r.end}:00`).join(', ')}
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-orange-600">
                      {b.total.toLocaleString()}đ
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={b.paid
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                          : 'bg-orange-500 hover:bg-orange-600 text-white'}
                      >
                        {b.paid ? '✅ Đã duyệt' : '⏳ Chờ thanh toán'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end flex-wrap">
                        {/* Nút DUYỆT - chỉ hiện khi chưa paid */}
                        {!b.paid && (
                          <Button
                            onClick={() => handleApprove(b.id)}
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Duyệt
                          </Button>
                        )}
                        {/* Nút HỦY DUYỆT - chỉ hiện khi đã paid */}
                        {b.paid && (
                          <Button
                            onClick={() => handleUnapprove(b.id)}
                            size="sm"
                            variant="outline"
                            className="border-orange-300 text-orange-600 hover:bg-orange-50 gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Hủy Duyệt
                          </Button>
                        )}
                        {/* Nút XÓA - luôn hiển thị */}
                        <Button
                          onClick={() => handleDelete(b.id)}
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-500 hover:bg-red-50 gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Xóa
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {bookings.length === 0 && (
                  <TableRow>
                     <TableCell colSpan={6} className="text-center text-slate-500 py-8">Chưa có đơn đặt sân nào</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

    </div>
  );
};
