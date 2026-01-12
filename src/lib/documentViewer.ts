export function openHtmlViewer(html: string, options?: { title?: string }) {
  const viewer = window.open('', '_blank', 'noopener');
  if (!viewer) {
    alert('Failed to open document viewer. Please allow pop-ups and try again.');
    return;
  }
  viewer.document.open();
  viewer.document.write(html);
  viewer.document.close();
  if (options?.title) {
    viewer.document.title = options.title;
  }
  viewer.focus();
}
