export const formatRupiah = (value: number) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);

export const formatRupiahWithDecimals = (value: number) =>
  `Rp. ${new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;

export const parseRupiahInput = (value: string): number | '' => {
  const cleaned = value
    .replace(/rp\.?/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.');
  if (!cleaned) return '';
  const parsed = Number.parseFloat(cleaned);
  if (Number.isNaN(parsed)) return '';
  return Math.round(parsed * 100) / 100;
};
