import { useEffect, useState } from 'react';
import { addRecord, deleteRecord, getRecords } from '../../lib/api';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

interface VariantOption {
  id: string;
  name: string;
  created_at: string;
}

type VariantKind = 'categories' | 'units';

const DEFAULT_CATEGORIES = ['consumable', 'instrument', 'electrical', 'piping', 'other'];
const DEFAULT_UNITS = ['pcs', 'box', 'kg', 'liter', 'meter', 'set'];

const normalizeLabel = (value: string) => value.trim().replace(/\s+/g, ' ');

export default function GoodsVariants() {
  const { profile } = useAuth();
  const canManage = ['superadmin', 'admin', 'manager'].includes(profile?.role ?? '');
  const [categories, setCategories] = useState<VariantOption[]>([]);
  const [units, setUnits] = useState<VariantOption[]>([]);
  const [categoryInput, setCategoryInput] = useState('');
  const [unitInput, setUnitInput] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchVariants = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    try {
      if (!silent) {
        setLoading(true);
      }
      const [categoryData, unitData] = await Promise.all([
        getRecords<VariantOption>('goods_categories'),
        getRecords<VariantOption>('goods_units'),
      ]);
      setCategories(categoryData);
      setUnits(unitData);
    } catch (error) {
      console.error('Error fetching goods variants:', error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchVariants();
  }, []);

  useAutoRefresh({
    onRefresh: () => fetchVariants({ silent: true }),
    pause: false,
  });

  const createVariant = async (kind: VariantKind) => {
    const value = normalizeLabel(kind === 'categories' ? categoryInput : unitInput);
    if (!value) {
      alert('Please enter a value before adding.');
      return;
    }

    const existing =
      kind === 'categories'
        ? categories.some((item) => item.name.toLowerCase() === value.toLowerCase())
        : units.some((item) => item.name.toLowerCase() === value.toLowerCase());
    if (existing) {
      alert(`"${value}" already exists.`);
      return;
    }

    try {
      if (kind === 'categories') {
        await addRecord<VariantOption>('goods_categories', { name: value } as VariantOption);
        setCategoryInput('');
      } else {
        await addRecord<VariantOption>('goods_units', { name: value } as VariantOption);
        setUnitInput('');
      }
      await fetchVariants();
    } catch (error) {
      console.error('Error adding variant:', error);
      alert('Failed to add the variant.');
    }
  };

  const removeVariant = async (kind: VariantKind, option: VariantOption) => {
    const confirmation = `Remove "${option.name}" from ${kind}?`;
    if (!confirm(confirmation)) return;
    try {
      await deleteRecord(kind === 'categories' ? 'goods_categories' : 'goods_units', option.id);
      await fetchVariants();
    } catch (error) {
      console.error('Error deleting variant:', error);
      alert('Failed to delete the variant.');
    }
  };

  const renderVariantCard = (
    kind: VariantKind,
    items: VariantOption[],
    value: string,
    setValue: (next: string) => void,
    placeholder: string,
    defaults: string[],
  ) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 capitalize">{kind}</h2>
          <p className="text-sm text-gray-500">
            Manage {kind} for goods selection.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => createVariant(kind)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500">
            {defaults.length > 0
              ? `No custom ${kind} yet. Defaults include ${defaults.join(', ')}.`
              : `No ${kind} available yet.`}
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
            >
              <span className="text-sm text-gray-800">{item.name}</span>
              <button
                type="button"
                onClick={() => removeVariant(kind, item)}
                className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Goods Variants</h1>
        <p className="text-gray-600 mt-1">Add or remove categories and units used in goods.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderVariantCard(
          'categories',
          categories,
          categoryInput,
          setCategoryInput,
          'Add new category',
          DEFAULT_CATEGORIES,
        )}
        {renderVariantCard('units', units, unitInput, setUnitInput, 'Add new unit', DEFAULT_UNITS)}
      </div>
    </div>
  );
}
