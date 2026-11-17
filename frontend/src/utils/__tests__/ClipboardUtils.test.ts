import * as ClipboardUtils from '../ClipboardUtils';
import type { Mock } from '@rstest/core';

describe('ClipboardUtils', () => {
  const originalClipboard = navigator.clipboard;
  const originalIsSecureContext = window.isSecureContext;
  let execCommandMock: Mock;

  beforeEach(() => {
    rstest.clearAllMocks();
    execCommandMock = rstest.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommandMock
    });
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard
    });
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: originalIsSecureContext
    });
    Reflect.deleteProperty(document, 'execCommand');
  });

  describe('writePlainTextToClipboard', () => {
    it('returns true when writeText succeeds', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: rstest.fn().mockResolvedValue(undefined)
        }
      });

      const result = await ClipboardUtils.writePlainTextToClipboard('hello');

      expect(result).toBe(true);
      expect(navigator.clipboard.writeText as Mock).toHaveBeenCalledWith('hello');
    });

    it('falls back to execCommand when writeText rejects', async () => {
      const consoleSpy = rstest.spyOn(console, 'warn').mockImplementation(() => undefined);

      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: rstest.fn().mockRejectedValue(new Error('denied'))
        }
      });

      const result = await ClipboardUtils.writePlainTextToClipboard('hello');

      expect(result).toBe(true);
      expect(execCommandMock).toHaveBeenCalledWith('copy');
      consoleSpy.mockRestore();
    });

    it('uses execCommand when not in a secure context', async () => {
      Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: rstest.fn().mockResolvedValue(undefined)
        }
      });

      const result = await ClipboardUtils.writePlainTextToClipboard('hello');

      expect(result).toBe(true);
      expect(navigator.clipboard.writeText as Mock).not.toHaveBeenCalled();
      expect(execCommandMock).toHaveBeenCalledWith('copy');
    });

    it('mounts execCommand fallback textarea inside an open modal', async () => {
      Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: rstest.fn().mockResolvedValue(undefined)
        }
      });

      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      const copyButton = document.createElement('button');
      dialog.appendChild(copyButton);
      document.body.appendChild(dialog);
      copyButton.focus();

      let textareaParentDuringCopy: HTMLElement | null = null;
      let selectedTextDuringCopy = '';
      execCommandMock.mockImplementation(() => {
        const textArea = dialog.querySelector('textarea');
        if (textArea instanceof HTMLTextAreaElement) {
          textareaParentDuringCopy = textArea.parentElement;
          selectedTextDuringCopy = textArea.value;
        }
        return true;
      });

      const result = await ClipboardUtils.writePlainTextToClipboard('modal payload');

      expect(result).toBe(true);
      expect(textareaParentDuringCopy).toBe(dialog);
      expect(selectedTextDuringCopy).toBe('modal payload');
      expect(document.activeElement).toBe(copyButton);

      document.body.removeChild(dialog);
    });

    it('returns false when Clipboard API and execCommand both fail', async () => {
      const consoleSpy = rstest.spyOn(console, 'warn').mockImplementation(() => undefined);
      execCommandMock.mockReturnValue(false);

      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: rstest.fn().mockRejectedValue(new Error('denied'))
        }
      });

      const result = await ClipboardUtils.writePlainTextToClipboard('hello');

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('writeMarkdownRichToClipboard', () => {
    it('falls back to plain text when ClipboardItem is undefined', async () => {
      const writeText = rstest.fn().mockResolvedValue(undefined);

      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText }
      });

      const hadClipboardItem = Object.prototype.hasOwnProperty.call(globalThis, 'ClipboardItem');
      const prevDescriptor = hadClipboardItem
        ? Object.getOwnPropertyDescriptor(globalThis, 'ClipboardItem')
        : undefined;

      Object.defineProperty(globalThis, 'ClipboardItem', {
        configurable: true,
        enumerable: true,
        value: undefined,
        writable: true
      });

      const result = await ClipboardUtils.writeMarkdownRichToClipboard('# title');

      expect(result).toBe(true);
      expect(writeText).toHaveBeenCalledWith('# title');

      if (hadClipboardItem && prevDescriptor) {
        Object.defineProperty(globalThis, 'ClipboardItem', prevDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'ClipboardItem');
      }
    });

    it('falls back to plain text when not in a secure context', async () => {
      Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });

      const result = await ClipboardUtils.writeMarkdownRichToClipboard('**bold**');

      expect(result).toBe(true);
      expect(execCommandMock).toHaveBeenCalledWith('copy');
    });
  });
});
