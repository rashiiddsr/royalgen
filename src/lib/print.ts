export const openPrintWindow = (html: string) => {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) {
    throw new Error('Failed to open print window');
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  const triggerPrint = () => {
    printWindow.focus();
    printWindow.print();
  };

  if (printWindow.document.readyState === 'complete') {
    setTimeout(triggerPrint, 250);
  } else {
    printWindow.onload = () => setTimeout(triggerPrint, 250);
  }

  printWindow.onafterprint = () => {
    printWindow.close();
  };
};
