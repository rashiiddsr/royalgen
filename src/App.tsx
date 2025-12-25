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
import Invoices from './components/Pages/Invoices';
import Financing from './components/Pages/Financing';
import Users from './components/Pages/Users';
import Profile from './components/Pages/Profile';

function App() {
  const { user, profile, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState(() => {
    if (typeof window === 'undefined') return 'dashboard';
    return localStorage.getItem('currentPage') || 'dashboard';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('currentPage', currentPage);
  }, [currentPage]);

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
      case 'invoices':
        return <Invoices />;
      case 'financing':
        return <Financing />;
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
