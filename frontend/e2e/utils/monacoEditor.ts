import { expect, type Page } from '@playwright/test';
import { getColWithRowText } from './table';
import { linkSelector } from './linkSelector';

export async function editIstioConfigYaml(page: Page): Promise<void> {
  const editor = page.locator('[data-test="istio-config-editor"] .monaco-editor');
  await expect(editor).toBeVisible();
  await expect(page.locator('[data-test="istio-config-editor"] .view-lines')).not.toBeEmpty();

  await page.evaluate(() => {
    const win = window as Window & {
      istioConfigEditor?: {
        getModel: () => { getLineCount: () => number; getLineMaxColumn: (line: number) => number };
        setPosition: (pos: { column: number; lineNumber: number }) => void;
        trigger: (source: string, handler: string, payload: { text: string }) => void;
      };
    };
    const ed = win.istioConfigEditor;
    if (!ed) {
      throw new Error('istioConfigEditor global not found');
    }
    const model = ed.getModel();
    const lastLine = model.getLineCount();
    const lastCol = model.getLineMaxColumn(lastLine);
    ed.setPosition({ lineNumber: lastLine, column: lastCol });
    ed.trigger('playwright-test', 'type', { text: '\n# playwright-unsaved-edit' });
  });

  await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
}

export async function expectEditorMatchesRegex(page: Page, regexContent: string): Promise<void> {
  await expect(page.locator('[data-test="editor-preview"], [data-test="istio-config-editor"]')).toBeVisible({
    timeout: 60_000
  });

  await expect
    .poll(async () => {
      return page.evaluate(pattern => {
        const win = window as Window & {
          monaco?: { editor: { getEditors: () => Array<{ getValue: () => string }> } };
        };
        const monaco = win.monaco;
        if (!monaco) {
          return false;
        }
        const editors = monaco.editor.getEditors();
        const regex = new RegExp(pattern);
        return editors.some(ed => {
          try {
            return regex.test(ed.getValue());
          } catch {
            return false;
          }
        });
      }, regexContent);
    })
    .toBe(true);
}

export async function clickIstioConfigRowLink(page: Page, column: string, rowText: string): Promise<void> {
  const cell = getColWithRowText(page, rowText, column);
  await cell.locator(linkSelector()).first().click();
}
