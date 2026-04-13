import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Video, 
  Settings2, 
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ScanLine,
  Receipt
} from 'lucide-react';
import { Button } from './ui/button';

export const Layout = () => {
  const { user, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: 'Tổng quan', icon: LayoutDashboard },
    { path: '/booking', label: 'Đặt sân', icon: CalendarDays },
    { path: '/my-bookings', label: 'Đơn hàng của tôi', icon: Receipt },
    { path: '/checkin', label: 'Quét Mã Mở Cửa', icon: ScanLine },
    { path: '/camera', label: 'Camera', icon: Video },
    { path: '/control', label: 'Điều khiển', icon: Settings2 },
  ];

  if (role === 'admin') {
    navItems.push({ path: '/admin', label: 'Quản trị viên', icon: ShieldCheck });
  }

  return (
    <div className="h-[100dvh] overflow-hidden overscroll-none bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center">
        <div className="font-bold text-xl flex items-center gap-2">
          <span className="text-orange-500">🏀</span> CourtKings
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar */}
      <div className={`
        ${isMobileMenuOpen ? 'flex' : 'hidden'} 
        flex-col md:flex w-full md:w-64 bg-slate-900 text-white flex-shrink-0 overflow-y-auto
      `}>
        <div className="p-6 hidden md:block flex-shrink-0">
          <div className="font-bold text-2xl flex items-center gap-2">
            <span className="text-orange-500">🏀</span> CourtKings
          </div>
        </div>
        
        <nav className="p-4 space-y-2 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-orange-500 text-white' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto flex-shrink-0 border-t border-slate-800">
          <div className="mb-4 px-4 text-sm text-slate-400 truncate">
            {user?.email}
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Đăng xuất
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div id="main-scroll-container" className="flex-1 overflow-y-auto overscroll-y-none bg-slate-950 relative">
        <main className={location.pathname === '/' ? '' : 'p-4 md:p-8 max-w-7xl mx-auto'}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
