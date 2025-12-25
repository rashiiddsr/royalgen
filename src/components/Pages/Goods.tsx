import { useState, useEffect, FormEvent } from 'react';
import { addRecord, getRecord, getRecords, updateRecord } from '../../lib/api';
import { Plus, Edit2, Search, Package, Eye } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface Good {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: 'consumable' | 'instrument' | 'electrical' | 'piping' | 'other';
  unit: string;
  price: number;
  stock_quantity: number;
  minimum_order_quantity: number;
  status: string;
  suppliers?: { id: string | number; name: string; status?: string }[];
  created_at: string;
}

type GoodFormData = Omit<Good, 'id' | 'created_at' | 'suppliers'> & {
  performed_by?: string | number;
  suppliers?: (string | number)[];
};

export default function Goods() {
  const [goods, setGoods] = useState<Good[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGood, setEditingGood] = useState<Good | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<GoodFormData>({
    sku: '',
    name: '',
    description: '',
    category: 'other',
    unit: 'pcs',
    price: 0,
    stock_quantity: 0,
    minimum_order_quantity: 1,
    status: 'active',
  });
  const [detailGood, setDetailGood] = useState<Good | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const { profile } = useAuth();

  const canChangeStatus =
    !!editingGood && ['admin', 'manager', 'superadmin'].includes(profile?.role ?? '');

  const categories: Good['category'][] = ['consumable', 'instrument', 'electrical', 'piping', 'other'];

  useEffect(() => {
    fetchGoods();
    fetchSuppliers();
  }, []);

  const generateSku = (category: Good['category']) => {
    const matchingGoods = goods.filter((item) => item.category === category && item.sku);
    const highestSequence = matchingGoods.reduce((max, item) => {
      const match = item.sku.match(/rgi-[^-]+-(\d{4})/i);
      if (!match) return max;
      const sequence = parseInt(match[1]);
      return Number.isFinite(sequence) && sequence > max ? sequence : max;
    }, 0);

    const nextSequence = (highestSequence || 0) + 1;
    return `rgi-${category}-${String(nextSequence).padStart(4, '0')}`;
  };

  const getInitialForm = (category: Good['category'] = 'other'): GoodFormData => ({
    sku: generateSku(category),
    name: '',
    description: '',
    category,
    unit: 'pcs',
    price: 0,
    stock_quantity: 0,
    minimum_order_quantity: 1,
    status: 'active',
  });

  const fetchGoods = async () => {
    try {
      const data = await getRecords<Good>('goods');
      const sorted = [...data].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setGoods(sorted.map((item) => ({ ...item })));
    } catch (error) {
      console.error('Error fetching goods:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const data = await getRecords<{ id: string; name: string }>('suppliers');
      setSuppliers(data.map((supplier) => ({ id: supplier.id, name: supplier.name })));
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload: GoodFormData = {
        ...formData,
        price: Number(formData.price),
        stock_quantity: Number(formData.stock_quantity),
        minimum_order_quantity: Number(formData.minimum_order_quantity),
        performed_by: profile?.id,
        suppliers: selectedSuppliers,
      };

      if (editingGood) {
        await updateRecord<Good>('goods', editingGood.id, payload as Good);
      } else {
        await addRecord<Good>('goods', payload as Good);
      }

      await fetchGoods();
      closeModal();
    } catch (error) {
      console.error('Error saving good:', error);
    }
  };

  const openDetails = async (good: Good) => {
    setDetailLoading(true);
    setDetailGood(good);

    try {
      const detailedGood = await getRecord<Good>('goods', good.id);
      setDetailGood(detailedGood);
    } catch (error) {
      console.error('Error loading good details:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const openModal = (good?: Good) => {
    if (good) {
      setEditingGood(good);
      setFormData({
        sku: good.sku,
        name: good.name,
        description: good.description,
        category: good.category,
        unit: good.unit,
        price: good.price,
        stock_quantity: good.stock_quantity,
        minimum_order_quantity: good.minimum_order_quantity,
        status: good.status,
      });
      setSelectedSuppliers((good.suppliers || []).map((supplier) => String(supplier.id)));
    } else {
      setEditingGood(null);
      setFormData(getInitialForm());
      setSelectedSuppliers([]);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingGood(null);
    setSelectedSuppliers([]);
  };

  const handleCategoryChange = (category: Good['category']) => {
    if (editingGood) {
      setFormData({ ...formData, category });
    } else {
      setFormData((prev) => ({ ...prev, category, sku: generateSku(category) }));
    }
  };

  const filteredGoods = goods.filter(good =>
    good.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    good.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    good.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSuppliers = suppliers.filter((supplier) =>
    supplier.name.toLowerCase().includes(supplierSearch.toLowerCase())
  );

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
          <h1 className="text-3xl font-bold text-gray-900">Goods</h1>
          <p className="text-gray-600 mt-1">Manage your product inventory</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Good
        </button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search goods..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock
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
              {filteredGoods.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No goods found. Add your first product to get started.
                  </td>
                </tr>
              ) : (
                filteredGoods.map((good) => (
                  <tr key={good.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Package className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{good.name}</div>
                          <div className="text-sm text-gray-500">SKU: {good.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{good.category}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      Rp {good.price.toLocaleString()} / {good.unit}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {good.stock_quantity} {good.unit}
                      </div>
                      <div className="text-xs text-gray-500">
                        MOQ: {good.minimum_order_quantity}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          good.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {good.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => openDetails(good)}
                        className="inline-flex items-center p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition"
                        aria-label="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openModal(good)}
                        className="inline-flex items-center p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingGood ? 'Edit Good' : 'Add Good'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU (Auto)</label>
                  <div className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-800">
                    {formData.sku || 'Generating SKU...'}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    SKU is generated automatically using rgi-(category)-0001 format based on sequence.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Suppliers</label>
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={supplierSearch}
                        onChange={(e) => setSupplierSearch(e.target.value)}
                        placeholder="Search and add suppliers"
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedSuppliers.length === 0 ? (
                        <span className="text-sm text-gray-500">No suppliers linked yet.</span>
                      ) : (
                        selectedSuppliers.map((supplierId) => {
                          const supplier = suppliers.find((item) => String(item.id) === supplierId);
                          if (!supplier) return null;
                          return (
                            <span
                              key={supplierId}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-800 text-sm rounded-full border border-blue-200"
                            >
                              {supplier.name}
                              <button
                                type="button"
                                className="text-blue-600 hover:text-blue-800"
                                onClick={() =>
                                  setSelectedSuppliers((prev) => prev.filter((id) => id !== supplierId))
                                }
                                aria-label={`Remove ${supplier.name}`}
                              >
                                ✕
                              </button>
                            </span>
                          );
                        })
                      )}
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100 max-h-40 overflow-y-auto">
                      {filteredSuppliers.length === 0 ? (
                        <div className="p-3 text-sm text-gray-600">{suppliers.length === 0 ? 'No suppliers available. Add suppliers first.' : 'No suppliers match your search.'}</div>
                      ) : (
                        filteredSuppliers.map((supplier) => (
                          <button
                            key={supplier.id}
                            type="button"
                            onClick={() =>
                              setSelectedSuppliers((prev) =>
                                prev.includes(String(supplier.id))
                                  ? prev
                                  : [...prev, String(supplier.id)]
                              )
                            }
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-left"
                          >
                            <span className="text-sm text-gray-800">{supplier.name}</span>
                            {selectedSuppliers.includes(String(supplier.id)) && (
                              <span className="text-xs text-blue-600 font-semibold">Linked</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Search and select multiple suppliers for this good.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleCategoryChange(e.target.value as Good['category'])}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {categories.map((category) => (
                      <option key={category} value={category} className="capitalize">
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="pcs">Pieces</option>
                    <option value="box">Box</option>
                    <option value="kg">Kilogram</option>
                    <option value="liter">Liter</option>
                    <option value="meter">Meter</option>
                    <option value="set">Set</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price (Rp)
                  </label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: Number(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stock Quantity
                  </label>
                  <input
                    type="number"
                    value={formData.stock_quantity}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stock_quantity: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Order Quantity
                  </label>
                  <input
                    type="number"
                    value={formData.minimum_order_quantity}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minimum_order_quantity: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                  />
                </div>

                {canChangeStatus ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                ) : editingGood ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <div className="mt-1">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          formData.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {formData.status}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="md:col-span-2 text-sm text-gray-600">
                    Status defaults to Active and cannot be changed during creation.
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  {editingGood ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailGood && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Goods Details</h3>
                <p className="text-sm text-gray-600">SKU {detailGood.sku}</p>
              </div>
              <button
                onClick={() => setDetailGood(null)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close details"
              >
                ✕
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-800">
              <div>
                <p className="font-semibold text-gray-700">Name</p>
                <p>{detailGood.name}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Category</p>
                <p className="capitalize">{detailGood.category}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Unit</p>
                <p>{detailGood.unit}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Price</p>
                <p>Rp {detailGood.price.toLocaleString()}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Stock</p>
                <p>
                  {detailGood.stock_quantity} {detailGood.unit}
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Minimum Order</p>
                <p>{detailGood.minimum_order_quantity}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Status</p>
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    detailGood.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {detailGood.status}
                </span>
              </div>
              <div className="md:col-span-2">
                <p className="font-semibold text-gray-700">Description</p>
                <p>{detailGood.description || '-'}</p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 space-y-3 text-sm text-gray-800">
              {detailLoading && (
                <p className="text-gray-500">Loading the latest supplier information...</p>
              )}
              <div>
                <p className="font-semibold text-gray-700">Suppliers</p>
                {detailGood.suppliers && detailGood.suppliers.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {detailGood.suppliers.map((supplier) => (
                      <li
                        key={supplier.id}
                        className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
                      >
                        <span className="font-medium text-gray-900">{supplier.name}</span>
                        {supplier.status && (
                          <span className="text-xs text-gray-500">Status: {supplier.status}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-600 mt-1">No linked suppliers yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
