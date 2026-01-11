import { FormEvent, useEffect, useMemo, useState } from 'react';
import { addRecord, deleteRecord, getRecords, updateRecord } from '../../lib/api';
import { Edit2, Plus, Search, Trash2, Tag } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

interface CategoryOption {
  id: string;
  name: string;
  created_at: string;
}

interface Good {
  id: string;
  category: string;
}

const normalizeKey = (value: string) => value.trim().toLowerCase();

export default function GoodsCategories() {
  const { profile } = useAuth();
  const canManage = ['superadmin', 'admin', 'manager'].includes(profile?.role ?? '');
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [goods, setGoods] = useState<Good[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryOption | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchCategories = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    try {
      if (!silent) {
        setLoading(true);
      }
      const data = await getRecords<CategoryOption>('goods_categories');
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const fetchGoods = async () => {
    try {
      const data = await getRecords<Good>('goods');
      setGoods(data);
    } catch (error) {
      console.error('Error fetching goods:', error);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchGoods();
  }, []);

  useAutoRefresh({
    onRefresh: () => {
      fetchCategories({ silent: true });
      fetchGoods();
    },
    pause: showModal,
  });

  const usageMap = useMemo(() => {
    return goods.reduce<Record<string, number>>((acc, item) => {
      const key = normalizeKey(item.category);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [goods]);

  const filteredCategories = categories.filter((category) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return category.name.toLowerCase().includes(query);
  });

  const openModal = (category?: CategoryOption) => {
    if (category) {
      setEditingCategory(category);
      setNameInput(category.name);
    } else {
      setEditingCategory(null);
      setNameInput('');
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setNameInput('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = nameInput.trim().replace(/\s+/g, ' ');
    if (!trimmed) {
      alert('Category name is required.');
      return;
    }
    const exists = categories.some(
      (item) => normalizeKey(item.name) === normalizeKey(trimmed) && item.id !== editingCategory?.id,
    );
    if (exists) {
      alert('Category already exists.');
      return;
    }

    try {
      if (editingCategory) {
        await updateRecord<CategoryOption>('goods_categories', editingCategory.id, { name: trimmed });
      } else {
        await addRecord<CategoryOption>('goods_categories', { name: trimmed } as CategoryOption);
      }
      await fetchCategories();
      await fetchGoods();
      closeModal();
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Failed to save category.');
    }
  };

  const handleDelete = async (category: CategoryOption) => {
    const count = usageMap[normalizeKey(category.name)] || 0;
    if (count > 0) {
      alert('Cannot delete a category that is already used by goods.');
      return;
    }
    if (!confirm(`Delete category "${category.name}"?`)) return;
    try {
      await deleteRecord('goods_categories', category.id);
      await fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Failed to delete category.');
    }
  };

  if (!canManage) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">You do not have access to this page.</div>
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold text-gray-900">Goods Categories</h1>
          <p className="text-gray-600 mt-1">Manage available category options.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Category
        </button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search categories..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Goods
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 dark:bg-slate-900 dark:divide-slate-800">
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <Tag className="h-10 w-10 text-gray-300 mb-3" />
                      <p>No categories found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCategories.map((category) => {
                  const count = usageMap[normalizeKey(category.name)] || 0;
                  return (
                    <tr key={category.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60">
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-slate-100">
                        {category.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-slate-100">
                        {count}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => openModal(category)}
                          className="inline-flex items-center p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition dark:hover:bg-slate-800/60"
                          aria-label="Edit category"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(category)}
                          className={`inline-flex items-center p-2 rounded-lg transition ${
                            count > 0
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-red-600 hover:bg-red-50'
                          }`}
                          aria-label="Delete category"
                          disabled={count > 0}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(event) => setNameInput(event.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
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
                  {editingCategory ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
