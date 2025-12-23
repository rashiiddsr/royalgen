import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { addRecord, getRecords } from '../../lib/api';
import { Plus, FileText, UploadCloud, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface RFQType {
  id: string;
  rfq_number: string;
  company_name: string;
  project_name: string;
  pic_name: string;
  pic_email: string;
  pic_phone: string;
  goods: { type: 'existing' | 'other'; good_id?: string | number | null; name?: string | null; display_name?: string }[];
  attachment_url?: string | null;
  status: string;
  created_at: string;
}

interface GoodOption {
  id: string;
  name: string;
}

const DEFAULT_FORM = {
  rfq_number: '',
  company_name: '',
  project_name: '',
  pic_name: '',
  pic_email: '',
  pic_phone: '',
};

export default function RFQ() {
  const { profile } = useAuth();
  const [rfqs, setRfqs] = useState<RFQType[]>([]);
  const [goods, setGoods] = useState<GoodOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedGoods, setSelectedGoods] = useState<string[]>([]);
  const [otherGoods, setOtherGoods] = useState<string[]>(['']);
  const [attachmentData, setAttachmentData] = useState<string | null>(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rfqData, goodsData] = await Promise.all([
        getRecords<RFQType>('rfqs'),
        getRecords<GoodOption>('goods'),
      ]);

      setRfqs(rfqData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setGoods(goodsData.map((good) => ({ id: good.id, name: (good as any).name || '' })));
    } catch (error) {
      console.error('Error fetching RFQs or goods:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result?.toString();
      if (result) setAttachmentData(result);
    };
    reader.readAsDataURL(file);
  };

  const updateOtherGood = (index: number, value: string) => {
    setOtherGoods((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const addOtherGood = () => setOtherGoods((prev) => [...prev, '']);
  const removeOtherGood = (index: number) => setOtherGoods((prev) => prev.filter((_, idx) => idx !== index));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      const goodsPayload = [
        ...selectedGoods.map((goodId) => ({ type: 'existing', good_id: goodId })),
        ...otherGoods
          .filter((name) => name.trim().length > 0)
          .map((name) => ({ type: 'other', name })),
      ];

      await addRecord<RFQType>('rfqs', {
        ...formData,
        goods: goodsPayload,
        attachment_data: attachmentData,
        performed_by: profile?.id,
      } as any);

      setFormData(DEFAULT_FORM);
      setSelectedGoods([]);
      setOtherGoods(['']);
      setAttachmentData(null);
      await fetchData();
    } catch (error) {
      console.error('Failed to save RFQ', error);
    } finally {
      setSaving(false);
    }
  };

  const renderGoodsList = (rfq: RFQType) => {
    if (!rfq.goods || rfq.goods.length === 0) return 'No goods listed';
    return rfq.goods
      .map((item) => item.display_name || item.name || goods.find((g) => g.id === item.good_id)?.name || 'Item')
      .join(', ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h1 className="text-3xl font-bold text-gray-900">Request for Quotation</h1>
        <p className="text-gray-600 mt-1">Capture detailed RFQ submissions with multiple goods and attachments.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <Plus className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">Create RFQ</h2>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RFQ Number</label>
              <input
                type="text"
                value={formData.rfq_number}
                onChange={(e) => setFormData({ ...formData, rfq_number: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
              <input
                type="text"
                value={formData.project_name}
                onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PIC Name</label>
              <input
                type="text"
                value={formData.pic_name}
                onChange={(e) => setFormData({ ...formData, pic_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PIC Email</label>
              <input
                type="email"
                value={formData.pic_email}
                onChange={(e) => setFormData({ ...formData, pic_email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PIC Phone</label>
              <input
                type="tel"
                value={formData.pic_phone}
                onChange={(e) => setFormData({ ...formData, pic_phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Goods</label>
              <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                {goods.length === 0 ? (
                  <div className="p-3 text-sm text-gray-600">No goods available.</div>
                ) : (
                  goods.map((good) => (
                    <label key={good.id} className="flex items-center justify-between px-3 py-2 bg-white hover:bg-gray-50">
                      <span className="text-sm text-gray-800">{good.name}</span>
                      <input
                        type="checkbox"
                        checked={selectedGoods.includes(String(good.id))}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedGoods((prev) =>
                            checked
                              ? [...prev, String(good.id)]
                              : prev.filter((id) => id !== String(good.id)),
                          );
                        }}
                        className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                    </label>
                  ))
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Other Goods</label>
              <div className="space-y-2">
                {otherGoods.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => updateOtherGood(index, e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Specify other good"
                    />
                    {otherGoods.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeOtherGood(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        aria-label="Remove other good"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addOtherGood}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  + Add another item
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Attachment</label>
            <div className="flex items-center gap-3 p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">
              <UploadCloud className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-800">Upload supporting file (optional)</p>
                <p className="text-xs text-gray-500">PDF or image, max 5MB</p>
                <input type="file" accept=".pdf,image/*" className="mt-2" onChange={handleFileChange} />
                {attachmentData && <p className="text-xs text-green-600 mt-1">File attached</p>}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save RFQ'}
            </button>
          </div>
        </form>
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
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{rfq.project_name}</h3>
                  <p className="text-sm text-gray-600">{rfq.rfq_number}</p>
                </div>
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">{rfq.status}</span>
              </div>
              <div className="space-y-2 text-sm text-gray-800 mb-3">
                <p>
                  <span className="text-gray-500">Company:</span> {rfq.company_name}
                </p>
                <p>
                  <span className="text-gray-500">PIC:</span> {rfq.pic_name} ({rfq.pic_email})
                </p>
                <p>
                  <span className="text-gray-500">Phone:</span> {rfq.pic_phone}
                </p>
                <p>
                  <span className="text-gray-500">Goods:</span> {renderGoodsList(rfq)}
                </p>
                {rfq.attachment_url && (
                  <p>
                    <a
                      href={rfq.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View attachment
                    </a>
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-500">Submitted on {new Date(rfq.created_at).toLocaleString()}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
