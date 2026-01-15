export const formatRupiah = (value: number) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);

export const formatRupiahWithDecimals = (value: number) =>
  `Rp. ${new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;

export const parseRupiahInput = (value: string): number | '' => {
  const cleaned = value.replace(/rp\.?/gi, '').replace(/\s/g, '');
  const [integerPart] = cleaned.split(',');
  const digits = (integerPart || '').replace(/\./g, '').replace(/[^\d]/g, '');
  if (!digits) return '';
  const parsed = Number.parseInt(digits, 10);
  if (Number.isNaN(parsed)) return '';
  return parsed;
};
