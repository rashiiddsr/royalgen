import { useEffect, useRef, useState, ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  Building2,
  Home,
  Users,
  Package,
  FileText,
  FileCheck,
  ShoppingCart,
  Truck,
  Receipt,
  Settings,
  UserCog,
  UserCircle,
  Menu,
  X,
  Bell,
  CheckCircle,
  ChevronDown,
} from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import { getRecords } from '../../lib/api';
import { ThemePreference } from '../../lib/theme';
import { getLanguagePreference, LanguagePreference, setLanguagePreference } from '../../lib/userPreferences';

interface DashboardProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
  themePreference: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
}

export default function Dashboard({ children, currentPage, onNavigate, themePreference, onThemeChange }: DashboardProps) {
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [languagePreference, setLanguagePreferenceState] = useState<LanguagePreference>(() =>
    getLanguagePreference()
  );
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const apiRoot = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/api$/, '');
  const { notifications, unreadCount, markAllRead, dismissNotification } = useNotifications();

  const navigation = [
    { name: 'Dashboard', icon: Home, page: 'dashboard', roles: ['superadmin', 'admin', 'manager', 'staff'] },
    { name: 'Suppliers', icon: Users, page: 'suppliers', roles: ['superadmin', 'admin', 'manager', 'staff'] },
    { name: 'Goods', icon: Package, page: 'goods', roles: ['superadmin', 'admin', 'manager', 'staff'] },
    { name: 'RFQ', icon: FileText, page: 'rfq', roles: ['superadmin', 'admin', 'manager', 'staff'] },
    { name: 'Quotations', icon: FileCheck, page: 'quotations', roles: ['superadmin', 'admin', 'manager', 'staff'] },
    { name: 'Sales Orders', icon: ShoppingCart, page: 'orders', roles: ['superadmin', 'admin', 'manager', 'staff'] },
    { name: 'Delivery Orders', icon: Truck, page: 'delivery-orders', roles: ['superadmin', 'admin', 'manager', 'staff'] },
    { name: 'Invoices', icon: Receipt, page: 'invoices', roles: ['superadmin', 'admin', 'manager', 'staff'] },
    { name: 'Profile', icon: UserCircle, page: 'profile', roles: ['superadmin', 'admin', 'manager', 'staff'] },
    { name: 'User Management', icon: UserCog, page: 'users', roles: ['superadmin', 'admin', 'manager'] },
    { name: 'Settings', icon: Settings, page: 'settings', roles: ['superadmin'] },
  ];

  const filteredNavigation = navigation.filter(item =>
    profile?.role && item.roles.includes(profile.role)
  );

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await getRecords<{ logo_url?: string | null }>('settings');
        const logoUrl = settings[0]?.logo_url;
        setCompanyLogoUrl(logoUrl ? `${apiRoot}${logoUrl}` : null);
      } catch (error) {
        console.error('Failed to fetch company logo', error);
      }
    };

    fetchSettings();
  }, [apiRoot]);

  useEffect(() => {
    setNotificationsOpen(false);
    setProfileMenuOpen(false);
  }, [currentPage]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleLanguageChange = (value: LanguagePreference) => {
    setLanguagePreferenceState(value);
    setLanguagePreference(value);
  };

  const avatarContent = profile?.photo_url ? (
    <img src={`${apiRoot}${profile.photo_url}`} alt="Avatar" className="h-full w-full object-cover" />
  ) : (
    profile?.full_name
      ?.split(' ')
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase())
      .slice(0, 2)
      .join('') || 'U'
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-emerald-50/30 dark:from-slate-950 dark:via-slate-900/80 dark:to-slate-900/60">
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-b border-gray-200 z-40 px-4 py-3 flex items-center justify-between shadow-sm dark:bg-slate-900/80 dark:border-slate-800">
        <div className="flex items-center">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-emerald-600 rounded-lg blur opacity-50"></div>
            <div className="relative bg-gradient-to-br from-blue-600 to-emerald-600 p-2 rounded-lg overflow-hidden">
              {companyLogoUrl ? (
                <img src={companyLogoUrl} alt="RGI logo" className="h-5 w-5 object-contain" />
              ) : (
                <Building2 className="h-5 w-5 text-white" />
              )}
            </div>
          </div>
          <div className="ml-3">
            <h1 className="text-base font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
              RGI NexaProc
            </h1>
            <p className="text-xs text-gray-600 font-medium dark:text-slate-400">Procurement</p>
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-xl hover:bg-gray-100 transition-all dark:hover:bg-slate-800"
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
        className={`fixed top-0 left-0 bottom-0 w-72 bg-white/80 backdrop-blur-xl border-r border-gray-200/50 z-40 transition-transform lg:translate-x-0 shadow-2xl dark:bg-slate-900/80 dark:border-slate-800 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-gray-200/50 dark:border-slate-800">
            <div className="flex items-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-emerald-600 rounded-2xl blur-lg opacity-50"></div>
                <div className="relative bg-gradient-to-br from-blue-600 to-emerald-600 p-3 rounded-2xl overflow-hidden">
                  {companyLogoUrl ? (
                    <img src={companyLogoUrl} alt="RGI logo" className="h-8 w-8 object-contain" />
                  ) : (
                    <Building2 className="h-8 w-8 text-white" />
                  )}
                </div>
              </div>
              <div className="ml-4">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
                  RGI NexaProc
                </h1>
                <p className="text-sm text-gray-600 font-medium dark:text-slate-400">Procurement</p>
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
                    setNotificationsOpen(false);
                    setProfileMenuOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3.5 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-emerald-600 text-white font-semibold shadow-lg shadow-blue-500/30 transform scale-[1.02]'
                      : 'text-gray-700 hover:bg-gray-100 font-medium dark:text-slate-200 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 mr-3 ${isActive ? 'text-white' : 'text-gray-500 dark:text-slate-400'}`}
                  />
                  {item.name}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      <main className="lg:ml-72 pt-16 lg:pt-0">
        <div className="p-6 lg:p-10">
          <div className="flex justify-end mb-4">
            <div className="flex items-center gap-3">
              <div className="relative" ref={notificationRef}>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((prev) => !prev)}
                  className="relative inline-flex items-center justify-center rounded-full border border-gray-200 bg-white p-2 text-gray-600 shadow-sm hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  aria-label="Toggle notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
                  <div className="absolute right-0 z-30 mt-3 w-80 rounded-xl border border-gray-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-slate-800">
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">Notifications</p>
                      <button
                        type="button"
                        onClick={() => markAllRead()}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Mark all read
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-slate-400">
                          Notifications are temporarily disabled.
                        </div>
                      ) : (
                        notifications.map((item) => (
                          <div
                            key={item.id}
                            className="border-b border-gray-100 px-4 py-3 last:border-b-0 dark:border-slate-800"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                                  {item.title}
                                </p>
                                <p className="text-xs text-gray-600 mt-1 dark:text-slate-300">
                                  {item.message}
                                </p>
                                <p className="text-xs text-gray-400 mt-2 dark:text-slate-400">
                                  {new Date(item.createdAt).toLocaleString()}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => dismissNotification(item.id)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                                aria-label="Dismiss notification"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                  className="flex items-center gap-3 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="h-8 w-8 rounded-full overflow-hidden bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">
                    {avatarContent}
                  </span>
                  <span className="hidden md:flex flex-col items-start leading-tight">
                    <span className="text-sm font-semibold">{profile?.full_name}</span>
                    <span className="text-xs text-gray-500 capitalize dark:text-slate-400">
                      {profile?.role}
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                </button>
                {profileMenuOpen && (
                  <div className="absolute right-0 z-30 mt-3 w-72 rounded-xl border border-gray-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800">
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                        {profile?.full_name}
                      </p>
                      <p className="text-xs text-gray-500 capitalize dark:text-slate-400">
                        {profile?.role}
                      </p>
                    </div>
                    <div className="px-4 py-3 space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase dark:text-slate-400">
                          Theme
                        </label>
                        <select
                          value={themePreference}
                          onChange={(event) => onThemeChange(event.target.value as ThemePreference)}
                          className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        >
                          <option value="system">System Default</option>
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase dark:text-slate-400">
                          Language
                        </label>
                        <select
                          value={languagePreference}
                          onChange={(event) => handleLanguageChange(event.target.value as LanguagePreference)}
                          className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        >
                          <option value="indonesia">Indonesia</option>
                          <option value="english">English</option>
                        </select>
                      </div>
                    </div>
                    <div className="border-t border-gray-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate('profile');
                          setProfileMenuOpen(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Profile Settings
                      </button>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
