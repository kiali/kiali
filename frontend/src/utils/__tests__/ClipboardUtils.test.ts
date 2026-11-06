import * as ClipboardUtils from '../ClipboardUtils';
import type { Mock } from '@rstest/core';

describe('ClipboardUtils', () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    rstest.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard
    });
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

    it('returns false when writeText rejects', async () => {
      const consoleSpy = rstest.spyOn(console, 'error').mockImplementation(() => undefined);

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
  });
});
