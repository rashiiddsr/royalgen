export const openPrintWindow = (html: string) => {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) {
    return false;
  }

  let url: string | null = null;
  try {
    const blob = new Blob([html], { type: 'text/html' });
    url = URL.createObjectURL(blob);
    printWindow.onload = () => {
      const triggerPrint = () => {
        printWindow.focus();
        printWindow.print();
      };
      setTimeout(triggerPrint, 250);
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
    printWindow.onafterprint = () => {
      printWindow.close();
    };
    printWindow.location.href = url;
  } catch (error) {
    console.error('Failed to render print document', error);
    if (url) {
      URL.revokeObjectURL(url);
    }
    return false;
  }

  return true;
};
