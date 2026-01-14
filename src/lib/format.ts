export const formatRupiah = (value: number) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);

export const formatRupiahWithDecimals = (value: number) =>
  `Rp. ${new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;

export const parseRupiahInput = (value: string): number | '' => {
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return '';
  return Number(digits);
};
