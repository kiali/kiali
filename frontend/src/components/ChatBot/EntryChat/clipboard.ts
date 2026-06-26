import DOMPurify from 'dompurify';
import { marked } from 'marked';

const supportsHtmlClipboard = (): boolean =>
  typeof ClipboardItem !== 'undefined' &&
  typeof ClipboardItem.supports === 'function' &&
  ClipboardItem.supports('text/html');

export const copyToClipboard = async (value: string): Promise<void> => {
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      const blobs: Record<string, Blob> = {
        'text/plain': new Blob([value], { type: 'text/plain' })
      };
      if (supportsHtmlClipboard()) {
        const html = DOMPurify.sanitize(marked.parse(value) as string);
        blobs['text/html'] = new Blob([html], { type: 'text/html' });
      }
      await navigator.clipboard.write([new ClipboardItem(blobs)]);
    } else {
      await navigator.clipboard.writeText(value);
    }
  } catch (err) {
    console.warn('Rich clipboard write failed, falling back to plain text: ', err);
    try {
      await navigator.clipboard.writeText(value);
    } catch (fallbackErr) {
      console.error('Failed to copy to clipboard: ', fallbackErr);
    }
  }
};
