import { useEffect, useRef, useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { applyTheme, ThemePreference } from './lib/theme';
import { getThemePreference, setThemePreference as persistThemePreference } from './lib/userPreferences';
import Login from './components/Auth/Login';
import Dashboard from './components/Layout/Dashboard';
import AppErrorBoundary from './components/Layout/AppErrorBoundary';
import DashboardHome from './components/Pages/DashboardHome';
import Suppliers from './components/Pages/Suppliers';
import Clients from './components/Pages/Clients';
import Goods from './components/Pages/Goods';
import RFQ from './components/Pages/RFQ';
import Quotations from './components/Pages/Quotations';
import Orders from './components/Pages/Orders';
import DeliveryOrders from './components/Pages/DeliveryOrders';
import Invoices from './components/Pages/Invoices';
import Users from './components/Pages/Users';
import Profile from './components/Pages/Profile';
import Settings from './components/Pages/Settings';
import OrderProgress from './components/Pages/OrderProgress';

function App() {
  const { user, profile, loading } = useAuth();
  const progressOrderId =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('progress_order')
      : null;
  const pageStorageKey = 'currentPage';
  const [currentPage, setCurrentPage] = useState(() => {
    if (typeof window === 'undefined') return 'dashboard';
    return sessionStorage.getItem(pageStorageKey) || 'dashboard';
  });
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => getThemePreference());
  const lastUserIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (progressOrderId) return;
    sessionStorage.setItem(pageStorageKey, currentPage);
  }, [currentPage, pageStorageKey, progressOrderId]);

  useEffect(() => {
    persistThemePreference(themePreference);
    applyTheme(themePreference);
  }, [themePreference]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (themePreference === 'system') {
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themePreference]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleDashboardNavigate = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (!customEvent.detail) return;
      setCurrentPage(customEvent.detail);
    };
    window.addEventListener('app:navigate', handleDashboardNavigate as EventListener);
    return () => window.removeEventListener('app:navigate', handleDashboardNavigate as EventListener);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!user || !profile) {
      sessionStorage.removeItem(pageStorageKey);
      setCurrentPage('dashboard');
      lastUserIdRef.current = null;
      return;
    }
    const nextUserId = profile.id ?? profile.email;
    if (lastUserIdRef.current !== nextUserId) {
      setCurrentPage('dashboard');
      sessionStorage.setItem(pageStorageKey, 'dashboard');
      lastUserIdRef.current = nextUserId;
    }
  }, [pageStorageKey, profile, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardHome />;
      case 'suppliers':
        return <Suppliers />;
      case 'clients':
        return <Clients />;
      case 'goods':
        return <Goods />;
      case 'rfq':
        return <RFQ />;
      case 'quotations':
        return <Quotations />;
      case 'orders':
        return <Orders />;
      case 'delivery-orders':
        return <DeliveryOrders />;
      case 'invoices':
        return <Invoices />;
      case 'settings':
        return <Settings />;
      case 'users':
        return <Users />;
      case 'profile':
        return <Profile />;
      default:
        return <DashboardHome />;
    }
  };

  return (
    <AppErrorBoundary onReset={() => window.location.reload()}>
      {!user || !profile ? (
        <Login />
      ) : progressOrderId ? (
        <OrderProgress orderId={progressOrderId} />
      ) : (
        <Dashboard
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          themePreference={themePreference}
          onThemeChange={setThemePreference}
        >
          {renderPage()}
        </Dashboard>
      )}
    </AppErrorBoundary>
  );
}

export default App;
