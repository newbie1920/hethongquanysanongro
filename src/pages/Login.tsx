import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();
  const { mockSignIn } = useAuth();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Check if Supabase is configured
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl || supabaseUrl === 'YOUR_SUPABASE_URL' || supabaseUrl.includes('placeholder')) {
      const isAdmin = email.toLowerCase().includes('admin') || email.toLowerCase() === 'banhaomangcut@gmail.com';
      toast.success(isAdmin ? 'Đăng nhập Quản Trị Viên (Mock Mode)' : 'Đăng nhập Khách (Mock Mode)');
      mockSignIn(isAdmin);
      navigate('/');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          toast.error('Mật khẩu nhập lại không khớp!');
          setLoading(false);
          return;
        }
        if (!phone || phone.length < 9) {
          toast.error('Vui lòng nhập số điện thoại hợp lệ!');
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              phone: phone,
            }
          }
        });
        if (error) throw error;
        toast.success('Vui lòng kiểm tra email để xác nhận!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate('/');
      }
    } catch (error: any) {
      let msg = error.message || 'Đã xảy ra lỗi';
      
      // Dịch các lỗi phổ biến của Supabase sang Tiếng Việt
      if (msg.includes('rate limit exceeded') || msg.includes('Too many requests')) {
        msg = 'Bạn đã thử quá nhiều lần (Vượt giới hạn email). Vui lòng đợi một lát rồi hãy thao tác lại hoặc tắt Xác nhận Email trong Supabase.';
      } else if (msg.includes('Invalid login credentials')) {
        msg = 'Tài khoản hoặc Mật khẩu không chính xác.';
      } else if (msg.includes('User already registered')) {
        msg = 'Email này đã được đăng ký rồi.';
      } else if (msg.includes('Password should be at least 6 characters')) {
        msg = 'Mật khẩu phải dài ít nhất 6 ký tự.';
      } else if (msg.includes('Email not confirmed')) {
        msg = 'Bạn chưa xác nhận Email. Vui lòng kiểm tra hòm thư của bạn.';
      }

      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || 'Lỗi đăng nhập bằng Google');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <span className="text-6xl">🏀</span>
          </div>
          <CardTitle className="text-3xl font-extrabold tracking-tight text-slate-900">
            CourtKings
          </CardTitle>
          <CardDescription>
            {isSignUp ? 'Tạo tài khoản để đặt sân' : 'Nhập email và mật khẩu để đăng nhập'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="m@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Nhập lại mật khẩu</Label>
                  <div className="relative">
                    <Input 
                      id="confirmPassword" 
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Số điện thoại</Label>
                  <Input 
                    id="phone" 
                    type="tel"
                    placeholder="VD: 0912345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            <Button className="w-full bg-orange-500 hover:bg-orange-600" type="submit" disabled={loading}>
              {loading ? 'Đang xử lý...' : (isSignUp ? 'Đăng ký' : 'Đăng nhập')}
            </Button>
          </form>
          
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-500">Hoặc tiếp tục với</span>
            </div>
          </div>
          
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleGoogleLogin} 
            className="w-full"
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Google
          </Button>

          <div className="mt-4 text-center text-sm">
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-orange-600 hover:underline"
            >
              {isSignUp ? 'Đã có tài khoản? Đăng nhập' : "Chưa có tài khoản? Đăng ký"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
