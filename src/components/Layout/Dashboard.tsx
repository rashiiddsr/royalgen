import { useState, ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  Building2,
  Home,
  Users,
  Package,
  FileText,
  FileCheck,
  ShoppingCart,
  Receipt,
  CreditCard,
  UserCog,
  UserCircle,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

interface DashboardProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function Dashboard({ children, currentPage, onNavigate }: DashboardProps) {
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const apiRoot = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/api$/, '');

  const navigation = [
    { name: 'Dashboard', icon: Home, page: 'dashboard', roles: ['owner', 'admin', 'manager', 'staff'] },
    { name: 'Suppliers', icon: Users, page: 'suppliers', roles: ['owner', 'admin', 'manager', 'staff'] },
    { name: 'Goods', icon: Package, page: 'goods', roles: ['owner', 'admin', 'manager', 'staff'] },
    { name: 'RFQ', icon: FileText, page: 'rfq', roles: ['owner', 'admin', 'manager', 'staff'] },
    { name: 'Quotations', icon: FileCheck, page: 'quotations', roles: ['owner', 'admin', 'manager', 'staff'] },
    { name: 'Sales Orders', icon: ShoppingCart, page: 'orders', roles: ['owner', 'admin', 'manager', 'staff'] },
    { name: 'Invoices', icon: Receipt, page: 'invoices', roles: ['owner', 'admin', 'manager', 'staff'] },
    { name: 'Financing', icon: CreditCard, page: 'financing', roles: ['owner', 'admin', 'manager', 'staff'] },
    { name: 'Profile', icon: UserCircle, page: 'profile', roles: ['owner', 'admin', 'manager', 'staff'] },
    { name: 'User Management', icon: UserCog, page: 'users', roles: ['owner', 'admin', 'manager'] },
  ];

  const filteredNavigation = navigation.filter(item =>
    profile?.role && item.roles.includes(profile.role)
  );

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-emerald-50/30">
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-b border-gray-200 z-40 px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-emerald-600 rounded-lg blur opacity-50"></div>
              <div className="relative bg-gradient-to-br from-blue-600 to-emerald-600 p-2 rounded-lg">
                <Building2 className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="ml-3">
              <h1 className="text-base font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">RGI NexaProc</h1>
              <p className="text-xs text-gray-600 font-medium">Procurement</p>
            </div>
          </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-xl hover:bg-gray-100 transition-all"
        >
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <div
        className={`fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-30 lg:hidden transition-opacity ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={`fixed top-0 left-0 bottom-0 w-72 bg-white/80 backdrop-blur-xl border-r border-gray-200/50 z-40 transition-transform lg:translate-x-0 shadow-2xl ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-gray-200/50">
            <div className="flex items-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-emerald-600 rounded-2xl blur-lg opacity-50"></div>
                <div className="relative bg-gradient-to-br from-blue-600 to-emerald-600 p-3 rounded-2xl">
                  <Building2 className="h-8 w-8 text-white" />
                </div>
              </div>
              <div className="ml-4">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
                  RGI NexaProc
                </h1>
                <p className="text-sm text-gray-600 font-medium">Procurement</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {filteredNavigation.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.page;
              return (
                <button
                  key={item.page}
                  onClick={() => {
                    onNavigate(item.page);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3.5 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-emerald-600 text-white font-semibold shadow-lg shadow-blue-500/30 transform scale-[1.02]'
                      : 'text-gray-700 hover:bg-gray-100 font-medium'
                  }`}
                >
                  <Icon className={`h-5 w-5 mr-3 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                  {item.name}
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-200/50">
            <div className="mb-4 p-4 bg-gradient-to-br from-blue-50 to-emerald-50 rounded-xl border border-blue-100 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full overflow-hidden bg-white border border-blue-100 flex items-center justify-center text-blue-700 font-semibold">
                {profile?.photo_url ? (
                  <img src={`${apiRoot}${profile.photo_url}`} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  profile?.full_name
                    ?.split(' ')
                    .filter(Boolean)
                    .map((part) => part[0]?.toUpperCase())
                    .slice(0, 2)
                    .join('') || 'U'
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{profile?.full_name}</p>
                <p className="text-xs text-gray-600 capitalize font-medium mt-1">{profile?.role}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 font-medium group"
            >
              <LogOut className="h-5 w-5 mr-3 group-hover:transform group-hover:-translate-x-1 transition-transform" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      <main className="lg:ml-72 pt-16 lg:pt-0">
        <div className="p-6 lg:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
