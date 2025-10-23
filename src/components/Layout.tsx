import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Settings, 
  LogOut, 
  Home, 
  AlertTriangle, 
  Users, 
  Wrench, 
  BarChart3,
  Building,
  Calendar,
  Menu,
  X
} from 'lucide-react';

export default function Layout() {
  const { appUser, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const menuItems = [
    { icon: Home, label: 'Ana Sayfa', path: '/dashboard', roles: ['admin', 'manager', 'department_manager', 'maintenance_personnel'] },
    { icon: AlertTriangle, label: 'Arıza Bildirimi', path: '/fault-report', roles: ['admin', 'manager', 'department_manager'] },
    { icon: Users, label: 'Atama Paneli', path: '/assignment', roles: ['admin', 'manager', 'department_manager'] },
    { icon: Wrench, label: 'Bakım İşlemleri', path: '/maintenance', roles: ['admin', 'manager', 'maintenance_personnel'] },
    { icon: Calendar, label: 'Bakım Takvimi', path: '/maintenance-calendar', roles: ['admin', 'manager', 'department_manager', 'maintenance_personnel'] },
    { icon: BarChart3, label: 'Raporlar', path: '/reports', roles: ['admin', 'manager', 'department_manager'] },
    { icon: Building, label: 'Makine Yönetimi', path: '/machines', roles: ['admin', 'manager'] },
    { icon: Settings, label: 'Sistem Yönetimi', path: '/admin', roles: ['admin'] },
  ];

  const filteredMenuItems = menuItems.filter(item => 
    appUser && item.roles.includes(appUser.role)
  );

  const getRoleDisplayName = (role: string) => {
    const roleNames = {
      admin: 'Ana Yönetici',
      manager: 'Yönetici',
      department_manager: 'Birim Yöneticisi',
      maintenance_personnel: 'Bakım Personeli'
    };
    return roleNames[role as keyof typeof roleNames] || role;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40">
        <div className="flex items-center justify-between p-4 bg-slate-800 text-white">
          <h1 className="text-xl font-bold">Bakım Takip Sistemi</h1>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-md hover:bg-slate-700 transition-colors"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Sidebar - Full height with proper flex layout */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-slate-800 to-slate-900 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 shadow-2xl flex flex-col`}>
        {/* Header - Fixed height */}
        <div className="flex items-center justify-center h-20 bg-slate-900 border-b border-slate-700 flex-shrink-0">
          <div className="text-center">
            <h1 className="text-white text-xl font-bold">Bakım Takip Sistemi</h1>
            <p className="text-slate-300 text-sm mt-1">Endüstriyel Çözümler</p>
          </div>
        </div>
        
        {/* Navigation - Scrollable middle section */}
        <div className="flex-1 overflow-y-auto">
          <nav className="mt-8 px-4 pb-4">
            <div className="space-y-2">
              {filteredMenuItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3 text-left transition-all duration-200 rounded-lg group ${
                    location.pathname === item.path
                      ? 'bg-orange-600 text-white shadow-lg transform scale-105'
                      : 'text-gray-300 hover:bg-slate-700 hover:text-white hover:transform hover:scale-105'
                  }`}
                >
                  <item.icon size={20} className={`mr-3 transition-transform duration-200 ${
                    location.pathname === item.path ? 'text-white' : 'group-hover:scale-110'
                  }`} />
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </nav>
        </div>

        {/* User info and logout - Fixed at bottom */}
        <div className="p-4 bg-slate-900 border-t border-slate-700 flex-shrink-0">
          <div className="bg-slate-800 rounded-lg p-4 mb-3">
            <div className="text-sm text-gray-300 mb-3">
              <p className="font-medium text-white text-base">{appUser?.name}</p>
              <p className="text-orange-400 font-medium">{getRoleDisplayName(appUser?.role || '')}</p>
              <p className="text-xs text-slate-400 mt-1">{appUser?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center px-4 py-2 text-gray-300 hover:bg-slate-700 hover:text-white rounded-md transition-all duration-200 hover:transform hover:scale-105"
            >
              <LogOut size={16} className="mr-2" />
              <span className="font-medium">Çıkış Yap</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 lg:ml-0">
        {/* Add top padding for mobile to account for fixed header */}
        <main className="p-6 lg:pt-6 pt-20">
          <Outlet />
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}