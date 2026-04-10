import React, { useState, useEffect } from 'react';
import { supabase, Court } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

import { Lock } from 'lucide-react';

const ADMIN_PIN = '8888'; // Anh có thể đổi mã PIN ở đây

export const Admin = () => {
  const [courts, setCourts] = useState<Court[]>([]);
  const [newCourtName, setNewCourtName] = useState('');
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (isAuthorized) {
      fetchCourts();
    }
  }, [isAuthorized]);

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
    </div>
  );
};
