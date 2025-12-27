import { useEffect, useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import Login from './components/Auth/Login';
import Dashboard from './components/Layout/Dashboard';
import DashboardHome from './components/Pages/DashboardHome';
import Suppliers from './components/Pages/Suppliers';
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
  const [currentPage, setCurrentPage] = useState(() => {
    if (typeof window === 'undefined') return 'dashboard';
    return localStorage.getItem('currentPage') || 'dashboard';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (progressOrderId) return;
    localStorage.setItem('currentPage', currentPage);
  }, [currentPage, progressOrderId]);

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

  if (!user || !profile) {
    return <Login />;
  }

  if (progressOrderId) {
    return <OrderProgress orderId={progressOrderId} />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardHome />;
      case 'suppliers':
        return <Suppliers />;
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
    <Dashboard currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </Dashboard>
  );
}

export default App;
