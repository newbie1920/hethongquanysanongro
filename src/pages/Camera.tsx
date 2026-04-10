import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Camera as CameraIcon, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';

export const Camera = () => {
  const [isLive, setIsLive] = useState(true);
  
  // In a real scenario, this would be the URL to the ESP32-CAM stream
  const streamUrl = "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Camera Sân</h1>
          <p className="text-slate-500">Xem trực tiếp từ ESP32-CAM.</p>
        </div>
        <Button variant="outline" onClick={() => setIsLive(!isLive)}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLive ? 'animate-spin' : ''}`} />
          {isLive ? 'Tạm dừng' : 'Tiếp tục phát'}
        </Button>
      </div>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50 border-b pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CameraIcon className="h-5 w-5 text-slate-500" />
              Sân A - Camera Chính
            </CardTitle>
            <Badge variant={isLive ? "default" : "secondary"} className={isLive ? "bg-red-500 hover:bg-red-600" : ""}>
              {isLive ? 'TRỰC TIẾP' : 'TẠM DỪNG'}
            </Badge>
          </div>
          <CardDescription>Luồng phát ESP32-CAM</CardDescription>
        </CardHeader>
        <CardContent className="p-0 bg-black aspect-video relative flex items-center justify-center">
          {isLive ? (
            <div className="relative w-full h-full">
              {/* Fallback image since we don't have a real ESP32-CAM stream */}
              <img 
                src={streamUrl} 
                alt="Live Stream" 
                className="w-full h-full object-cover opacity-80"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-4 right-4 flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
              </div>
              <div className="absolute bottom-4 left-4 text-white text-sm font-mono bg-black/50 px-2 py-1 rounded">
                {new Date().toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="text-slate-500 flex flex-col items-center">
              <CameraIcon className="h-12 w-12 mb-2 opacity-50" />
              <p>Đã tạm dừng phát</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AI Nhận diện</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Trạng thái</span>
                <Badge className="bg-green-500">Hoạt động</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Số người</span>
                <span className="font-bold text-lg">4</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Chuyển động cuối</span>
                <span className="text-sm">Vừa xong</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ảnh chụp</CardTitle>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="secondary">
              <CameraIcon className="mr-2 h-4 w-4" />
              Chụp ảnh
            </Button>
            <p className="text-xs text-slate-500 mt-4 text-center">
              Ảnh chụp được lưu vào Supabase Storage.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
