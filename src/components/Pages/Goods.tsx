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
  minimum_order_quantity: number;
  status: string;
  suppliers?: { id: string | number; name: string; status?: string }[];
  created_at: string;
}

type GoodFormData = Omit<
  Good,
  'id' | 'created_at' | 'suppliers' | 'price' | 'minimum_order_quantity'
> & {
  performed_by?: string | number;
  suppliers?: (string | number)[];
  category: Good['category'] | '';
  unit: string | '';
  price: number | '';
  minimum_order_quantity: number | '';
};

export default function Goods() {
  const [goods, setGoods] = useState<Good[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; status?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGood, setEditingGood] = useState<Good | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<GoodFormData>({
    sku: '',
    name: '',
    description: '',
    category: '',
    unit: '',
    price: '',
    minimum_order_quantity: '',
    status: 'active',
  });
  const [detailGood, setDetailGood] = useState<Good | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const { profile } = useAuth();

  const canToggleStatus = ['admin', 'manager', 'superadmin'].includes(profile?.role ?? '');

  const categories: Good['category'][] = ['consumable', 'instrument', 'electrical', 'piping', 'other'];
  const getCategoryBadge = (category: Good['category']) => {
    const styles: Record<Good['category'], string> = {
      consumable: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200',
      instrument: 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200',
      electrical: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
      piping: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
      other: 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-100',
    };
    return styles[category] || 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-100';
  };

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

  const getInitialForm = (): GoodFormData => ({
    sku: '',
    name: '',
    description: '',
    category: '',
    unit: '',
    price: '',
    minimum_order_quantity: '',
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
      const data = await getRecords<{ id: string; name: string; status?: string | null }>('suppliers');
      setSuppliers(data.map((supplier) => ({ id: supplier.id, name: supplier.name, status: supplier.status })));
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (formData.price === '') {
        alert('Price is required.');
        return;
      }
      const payload: GoodFormData = {
        ...formData,
        price: Number(formData.price),
        minimum_order_quantity:
          formData.minimum_order_quantity === '' ? 1 : Number(formData.minimum_order_quantity),
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

  const handleCategoryChange = (category: Good['category'] | '') => {
    if (editingGood) {
      setFormData({ ...formData, category });
    } else {
      setFormData((prev) => ({
        ...prev,
        category,
        sku: category ? generateSku(category) : '',
      }));
    }
  };

  const handleToggleStatus = async (good: Good) => {
    if (!canToggleStatus) {
      alert('Only managers can update goods status.');
      return;
    }
    const nextStatus = good.status === 'active' ? 'inactive' : 'active';
    const confirmation =
      nextStatus === 'inactive'
        ? 'Mark this good as inactive?'
        : 'Activate this good?';
    if (!confirm(confirmation)) return;

    try {
      await updateRecord<Good>('goods', good.id, {
        status: nextStatus,
        performed_by: profile?.id,
      });
      fetchGoods();
    } catch (error) {
      console.error('Error updating goods status:', error);
      alert(error instanceof Error ? error.message : 'Failed to update goods.');
    }
  };

  const filteredGoods = goods.filter((good) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return (
      good.name.toLowerCase().includes(query) ||
      good.sku.toLowerCase().includes(query) ||
      good.category.toLowerCase().includes(query) ||
      good.description.toLowerCase().includes(query) ||
      good.unit.toLowerCase().includes(query)
    );
  });

  const activeSuppliers = suppliers.filter((supplier) => (supplier.status || 'active') === 'active');
  const filteredSuppliers = activeSuppliers.filter((supplier) =>
    supplier.name.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const formatRupiah = (value: number) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);

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
                  Unit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 dark:bg-slate-900 dark:divide-slate-800">
              {filteredGoods.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No goods found. Add your first product to get started.
                  </td>
                </tr>
              ) : (
                filteredGoods.map((good) => (
                  <tr key={good.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center dark:bg-blue-500/20">
                          <Package className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-slate-100">{good.name}</div>
                          <div className="text-sm text-gray-500 dark:text-slate-400">
                            {`SKU: ${good.sku}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-slate-100">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full capitalize ${getCategoryBadge(
                          good.category,
                        )}`}
                      >
                        {good.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-slate-100">
                      <div>{`Rp ${formatRupiah(Number(good.price) || 0)}`}</div>
                      <div className="text-xs text-gray-500 dark:text-slate-400">
                        {`MOQ: ${good.minimum_order_quantity}`}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-slate-100">{good.unit}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          good.status === 'active'
                            ? 'bg-green-100 text-green-800 dark:bg-emerald-500/20 dark:text-emerald-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200'
                        }`}
                      >
                        {good.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => openDetails(good)}
                        className="inline-flex items-center p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition dark:hover:bg-amber-500/10"
                        aria-label="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openModal(good)}
                        className="inline-flex items-center p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition dark:hover:bg-slate-800/60"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(good)}
                        disabled={!canToggleStatus}
                        className={`inline-flex items-center p-2 rounded-full transition ${
                          !canToggleStatus
                            ? 'text-gray-300 cursor-not-allowed'
                            : good.status === 'active'
                              ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                              : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800/60'
                        }`}
                        aria-label={`Set good ${good.status === 'active' ? 'inactive' : 'active'}`}
                      >
                        <span
                          className={`relative inline-flex h-5 w-9 items-center rounded-full ${
                            good.status === 'active'
                              ? 'bg-emerald-500'
                              : 'bg-gray-300 dark:bg-slate-700'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                              good.status === 'active' ? 'translate-x-4' : 'translate-x-1'
                            }`}
                          />
                        </span>
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
                    {formData.sku || 'Select a category to generate SKU.'}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    SKU is generated automatically using rgi-(category)-0001 format based on sequence.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
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
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    required
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

                    {supplierSearch.trim() ? (
                      <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100 max-h-40 overflow-y-auto">
                        {filteredSuppliers.length === 0 ? (
                          <div className="p-3 text-sm text-gray-600">
                            {activeSuppliers.length === 0
                              ? 'No active suppliers available. Add active suppliers first.'
                              : 'No suppliers match your search.'}
                          </div>
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
                              className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-left dark:hover:bg-slate-800/60"
                            >
                              <span className="text-sm text-gray-800">{supplier.name}</span>
                              {selectedSuppliers.includes(String(supplier.id)) && (
                                <span className="text-xs text-blue-600 font-semibold">Linked</span>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Type to search suppliers.</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Search and select multiple suppliers for this good.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleCategoryChange(e.target.value as Good['category'] | '')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="" disabled>
                      Select category
                    </option>
                    {categories.map((category) => (
                      <option key={category} value={category} className="capitalize">
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="" disabled>
                      Select unit
                    </option>
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
                    Price (Rp) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({ ...formData, price: value === '' ? '' : Number(value) });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Order Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.minimum_order_quantity}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({
                        ...formData,
                        minimum_order_quantity: value === '' ? '' : Math.max(1, Number(value) || 1),
                      });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <div className="mt-1">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        formData.status === 'active'
                          ? 'bg-green-100 text-green-800 dark:bg-emerald-500/20 dark:text-emerald-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200'
                      }`}
                    >
                      {formData.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Status can be changed via the toggle in the table.</p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/60"
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
                <p className="text-sm text-gray-600">{`SKU ${detailGood.sku}`}</p>
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
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full capitalize ${getCategoryBadge(
                    detailGood.category,
                  )}`}
                >
                  {detailGood.category}
                </span>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Unit</p>
                <p>{detailGood.unit}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Price</p>
                <p>{`Rp ${formatRupiah(Number(detailGood.price) || 0)}`}</p>
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
                      ? 'bg-green-100 text-green-800 dark:bg-emerald-500/20 dark:text-emerald-200'
                      : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200'
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
                          <span className="text-xs text-gray-500">
                            Status: {supplier.status}
                          </span>
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
