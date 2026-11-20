import DOMPurify from 'dompurify';
import { marked } from 'marked';

const supportsHtmlClipboard = (): boolean =>
  typeof ClipboardItem !== 'undefined' &&
  typeof ClipboardItem.supports === 'function' &&
  ClipboardItem.supports('text/html');

const canUseClipboardApi = (): boolean =>
  typeof navigator !== 'undefined' &&
  typeof navigator.clipboard?.writeText === 'function' &&
  typeof window !== 'undefined' &&
  window.isSecureContext;

/**
 * Container for the execCommand fallback textarea. When copy is triggered inside a dialog,
 * the temporary control must stay inside the focus trap (not document.body).
 */
const getExecCommandCopyContainer = (): HTMLElement => {
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    const dialog = active.closest('[role="dialog"]');
    if (dialog instanceof HTMLElement) {
      return dialog;
    }
  }
  return document.body;
};

/**
 * Plain text via textarea + execCommand (HTTP and Clipboard API fallback).
 */
const copyPlainTextWithExecCommand = (text: string): boolean => {
  const container = getExecCommandCopyContainer();
  const previousFocus = document.activeElement;

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.setAttribute('aria-hidden', 'true');
  textArea.tabIndex = -1;
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  textArea.style.top = '0';

  container.appendChild(textArea);
  textArea.focus({ preventScroll: true });
  textArea.select();
  textArea.setSelectionRange(0, text.length);

  let ok = false;
  try {
    if (typeof document.execCommand === 'function') {
      ok = document.execCommand('copy');
    }
  } finally {
    container.removeChild(textArea);
    if (previousFocus instanceof HTMLElement) {
      previousFocus.focus({ preventScroll: true });
    }
  }
  return ok;
};

/**
 * Plain text only; returns whether the write succeeded.
 */
export const writePlainTextToClipboard = async (text: string): Promise<boolean> => {
  if (canUseClipboardApi()) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('Clipboard API write failed, falling back to execCommand: ', err);
    }
  }

  try {
    return copyPlainTextWithExecCommand(text);
  } catch (err) {
    console.error('Failed to copy to clipboard: ', err);
    return false;
  }
};

/**
 * Copies markdown for rich paste (e.g. chat, Word) when HTTPS allows ClipboardItem + HTML.
 * On HTTP, copies markdown as plain text only using writePlainTextToClipboard method.
 */
export const writeMarkdownRichToClipboard = async (value: string): Promise<boolean> => {
  try {
    if (canUseClipboardApi() && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
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
