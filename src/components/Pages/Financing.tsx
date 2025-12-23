import { useState, useEffect } from 'react';
import { getRecords } from '../../lib/supabase';
import { Plus, Eye, CreditCard } from 'lucide-react';

interface FinancingType {
  id: string;
  financing_number: string;
  invoice_id: string;
  financing_type: string;
  amount: number;
  interest_rate: number;
  term_months: number;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  invoices?: {
    invoice_number: string;
    suppliers?: { name: string };
  };
}

interface Invoice {
  id: string;
  invoice_number: string;
  supplier_id: string;
  suppliers?: { name: string };
  created_at: string;
}

interface Supplier {
  id: string;
  name: string;
}

export default function Financing() {
  const [financings, setFinancings] = useState<FinancingType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFinancings();
  }, []);

  const fetchFinancings = async () => {
    try {
      const [financingData, invoiceData, supplierData] = await Promise.all([
        getRecords<FinancingType>('financing'),
        getRecords<Invoice>('invoices'),
        getRecords<Supplier>('suppliers'),
      ]);

      const suppliersById = new Map(supplierData.map((supplier) => [supplier.id, supplier]));
      const invoicesById = new Map(
        invoiceData.map((invoice) => [
          invoice.id,
          {
            ...invoice,
            suppliers: suppliersById.get(invoice.supplier_id),
          },
        ]),
      );

      const mappedFinancing = financingData
        .map((financing) => ({
          ...financing,
          invoices: invoicesById.get(financing.invoice_id),
        }))
        .sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );

      setFinancings(mappedFinancing);
    } catch (error) {
      console.error('Error fetching financing:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getFinancingTypeName = (type: string) => {
    const types: Record<string, string> = {
      bank_loan: 'Bank Loan',
      credit_line: 'Credit Line',
      factoring: 'Factoring',
      leasing: 'Leasing',
    };
    return types[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Financing</h1>
          <p className="text-gray-600 mt-1">Manage financing and payment plans</p>
        </div>
        <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
          <Plus className="h-5 w-5 mr-2" />
          New Financing
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total Financing</p>
          <p className="text-2xl font-bold text-gray-900">Rp 0</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Active</p>
          <p className="text-2xl font-bold text-green-600">Rp 0</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Pending Approval</p>
          <p className="text-2xl font-bold text-yellow-600">Rp 0</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Completed</p>
          <p className="text-2xl font-bold text-gray-600">Rp 0</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Financing No.
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice / Supplier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Terms
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {financings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No financing records found.</p>
                  </td>
                </tr>
              ) : (
                financings.map((financing) => (
                  <tr key={financing.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {financing.financing_number}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(financing.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {financing.invoices?.invoice_number || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {financing.invoices?.suppliers?.name || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {getFinancingTypeName(financing.financing_type)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        Rp {financing.amount.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {financing.term_months} months
                      </div>
                      <div className="text-xs text-gray-500">
                        {financing.interest_rate}% interest
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          financing.status
                        )}`}
                      >
                        {financing.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="inline-flex items-center p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition">
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
