import DOMPurify from 'dompurify';
import { marked } from 'marked';

const supportsHtmlClipboard = (): boolean =>
  typeof ClipboardItem !== 'undefined' &&
  typeof ClipboardItem.supports === 'function' &&
  ClipboardItem.supports('text/html');

/** Plain text only; returns whether the write succeeded. */
export const writePlainTextToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard: ', err);
    return false;
  }
};

/**
 * Copies markdown as plain text plus optional HTML for rich paste (e.g. chat, Word).
 * Returns whether a plain-text write eventually succeeded.
 */
export const writeMarkdownRichToClipboard = async (value: string): Promise<boolean> => {
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
      return true;
    }
    return await writePlainTextToClipboard(value);
  } catch (err) {
    console.warn('Rich clipboard write failed, falling back to plain text: ', err);
    return await writePlainTextToClipboard(value);
  }
};
