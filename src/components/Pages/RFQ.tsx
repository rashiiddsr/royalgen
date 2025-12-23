import { useState, useEffect } from 'react';
import { getRecords } from '../../lib/api';
import { Plus, Eye, Edit2, FileText } from 'lucide-react';

interface RFQType {
  id: string;
  rfq_number: string;
  title: string;
  description: string;
  supplier_id: string;
  status: string;
  due_date: string;
  created_at: string;
  suppliers?: { name: string };
}

interface Supplier {
  id: string;
  name: string;
}

export default function RFQ() {
  const [rfqs, setRfqs] = useState<RFQType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRFQs();
  }, []);

  const fetchRFQs = async () => {
    try {
      const [rfqData, supplierData] = await Promise.all([
        getRecords<RFQType>('rfqs'),
        getRecords<Supplier>('suppliers'),
      ]);

      const suppliersById = new Map(supplierData.map((supplier) => [supplier.id, supplier]));
      const mapped = rfqData
        .map((rfq) => ({
          ...rfq,
          suppliers: suppliersById.get(rfq.supplier_id),
        }))
        .sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );

      setRfqs(mapped);
    } catch (error) {
      console.error('Error fetching RFQs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      quoted: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
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
          <h1 className="text-3xl font-bold text-gray-900">Request for Quotation</h1>
          <p className="text-gray-600 mt-1">Manage RFQs sent to suppliers</p>
        </div>
        <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
          <Plus className="h-5 w-5 mr-2" />
          Create RFQ
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rfqs.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No RFQs found. Create your first RFQ to get started.</p>
          </div>
        ) : (
          rfqs.map((rfq) => (
            <div
              key={rfq.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{rfq.title}</h3>
                  <p className="text-sm text-gray-600">{rfq.rfq_number}</p>
                </div>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(rfq.status)}`}>
                  {rfq.status}
                </span>
              </div>

              <p className="text-sm text-gray-700 mb-4 line-clamp-2">{rfq.description}</p>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Supplier:</span>
                  <span className="font-medium text-gray-900">{rfq.suppliers?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Due Date:</span>
                  <span className="font-medium text-gray-900">
                    {rfq.due_date ? new Date(rfq.due_date).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="flex space-x-2 pt-4 border-t border-gray-200">
                <button className="flex-1 flex items-center justify-center px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition">
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </button>
                <button className="flex-1 flex items-center justify-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition">
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
