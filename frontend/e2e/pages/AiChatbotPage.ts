import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import {
  mockChatAiResponse,
  mockChatAiStreamNoEnd,
  waitForChatAiPost,
  type ChatRequestCapture
} from '../utils/aiChatbotHelpers';
import { mockPayload, SECOND_PROVIDER_NAME, type MockStreamPayload } from '../utils/aiChatbotMocks';
import { gotoConsolePage } from '../utils/navigation';
import { waitForLoadingComplete } from '../utils/transition';

export class AiChatbotPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  chatbotVisible(): Locator {
    return this.page.locator('.pf-chatbot.pf-chatbot--visible');
  }

  chatbotHidden(): Locator {
    return this.page.locator('.pf-chatbot.pf-chatbot--hidden');
  }

  toggle(): Locator {
    return this.getBySel('ai-chatbot-toggle');
  }

  messageInput(): Locator {
    return this.page.locator('[data-testid="chatbot-message-bar-input"]');
  }

  sendButton(): Locator {
    return this.page.locator('.pf-chatbot__button--send');
  }

  stopButton(): Locator {
    return this.page.locator('.pf-chatbot__button--stop');
  }

  alwaysNavigateSwitch(): Locator {
    return this.page.locator('[data-testid="chatbot-always-navigate-switch"]');
  }

  newChatModal(): Locator {
    return this.getBySel('new-chat-modal');
  }

  toolModal(): Locator {
    return this.getBySel('ai-tool-modal');
  }

  yamlModal(): Locator {
    return this.page.locator('[data-ouia-component-id="chatbot-yaml-modal"]');
  }

  interactionModeToggle(): Locator {
    return this.page.locator('[data-testid="chatbot-interaction-mode-toggle"]');
  }

  toolLabel(name: string): Locator {
    return this.page.locator(`[data-test="ai-tool-label-${name}"]`);
  }

  async expectToggleVisible(): Promise<void> {
    await expect(this.toggle()).toBeVisible();
  }

  async clickToggle(): Promise<void> {
    await this.toggle().click();
  }

  async expectOpen(): Promise<void> {
    await expect(this.chatbotVisible()).toBeVisible();
  }

  async expectClosed(): Promise<void> {
    await expect(this.chatbotHidden()).toBeVisible();
  }

  async open(): Promise<void> {
    await this.clickToggle();
    await this.expectOpen();
  }

  async expectWelcomeMessage(): Promise<void> {
    await expect(this.page.locator('.pf-chatbot__hello')).toContainText('Welcome to Kiali Chatbot');
    await expect(this.page.locator('.pf-chatbot__question')).toContainText('How may I help you today?');
  }

  async ensureLightTheme(): Promise<void> {
    const html = this.page.locator('html');
    if (await html.evaluate(el => el.classList.contains('pf-v6-theme-dark'))) {
      await this.page.getByRole('button', { name: 'Light theme' }).click();
      await expect(html).not.toHaveClass(/pf-v6-theme-dark/);
    }
    await this.page.evaluate(() => window.localStorage.removeItem('KIALI_THEME'));
  }

  async switchToDarkTheme(): Promise<void> {
    await this.page.getByRole('button', { name: 'Dark theme' }).click();
    await expect(this.page.locator('html')).toHaveClass(/pf-v6-theme-dark/);
  }

  async switchToLightTheme(): Promise<void> {
    await this.page.getByRole('button', { name: 'Light theme' }).click();
    await expect(this.page.locator('html')).not.toHaveClass(/pf-v6-theme-dark/);
  }

  async expectLightThemeToggleIcon(): Promise<void> {
    await expect(this.getBySel('ai-chatbot-toggle-icon-light')).toBeVisible();
    await expect(this.getBySel('ai-chatbot-toggle-icon-dark')).toHaveCount(0);
  }

  async expectDarkThemeToggleIcon(): Promise<void> {
    await expect(this.getBySel('ai-chatbot-toggle-icon-dark')).toBeVisible();
    await expect(this.getBySel('ai-chatbot-toggle-icon-light')).toHaveCount(0);
  }

  async clickDock(): Promise<void> {
    await this.getBySel('chatbot-display-dock').click();
  }

  async clickOverlay(): Promise<void> {
    await this.getBySel('chatbot-display-overlay').click();
  }

  async clickMinimize(): Promise<void> {
    await this.getBySel('chatbot-minimize').click();
  }

  async expectDisplayMode(mode: 'default' | 'docked'): Promise<void> {
    await expect(this.page.locator(`.pf-chatbot.pf-chatbot--${mode}`)).toBeVisible();
  }

  async expectDockedHeightCssVariable(): Promise<void> {
    await expect
      .poll(async () =>
        this.page.evaluate(() =>
          document.documentElement.style.getPropertyValue('--kiali-chatbot-docked-height').trim()
        )
      )
      .toMatch(/^\d+(\.\d+)?px$/);
  }

  async sendMessage(
    message: string,
    payload: MockStreamPayload = mockPayload,
    options: { capture?: ChatRequestCapture } = {}
  ): Promise<void> {
    await mockChatAiResponse(this.page, payload, { capture: options.capture });
    const responsePromise = waitForChatAiPost(this.page);
    await this.messageInput().fill(message);
    await this.sendButton().click();
    await responsePromise;
  }

  async sendMessageStreamNoEnd(message: string, payload: MockStreamPayload): Promise<void> {
    await mockChatAiStreamNoEnd(this.page, payload);
    const responsePromise = waitForChatAiPost(this.page);
    await this.messageInput().fill(message);
    await this.sendButton().click();
    await responsePromise;
  }

  async expectAnswerContains(text: string): Promise<void> {
    await expect(this.chatbotVisible()).toContainText(text);
  }

  async expectNotContainText(text: string): Promise<void> {
    await expect(this.chatbotVisible()).not.toContainText(text);
  }

  async expectStopButtonVisible(): Promise<void> {
    await expect(this.stopButton()).toBeVisible();
  }

  async clickStop(): Promise<void> {
    await this.stopButton().click();
  }

  async expectCancelledAlert(): Promise<void> {
    await expect(this.chatbotVisible()).toContainText('Cancelled');
  }

  async expectSourcesCard(sourceCount: number): Promise<void> {
    await expect(this.page.locator('.pf-chatbot__source')).toContainText(`${sourceCount} sources`);
  }

  async expectAlwaysNavigateUnchecked(): Promise<void> {
    await expect(this.alwaysNavigateSwitch()).not.toBeChecked();
  }

  async setAlwaysNavigate(enable: boolean): Promise<void> {
    const sw = this.alwaysNavigateSwitch();
    // Click the PF switch chrome — the input is covered by `.pf-v6-c-switch__toggle`.
    const toggle = this.page.locator('.pf-v6-c-switch').filter({ has: sw });
    if (enable) {
      await expect(sw).not.toBeChecked();
      await toggle.click();
      await expect(sw).toBeChecked();
    } else {
      await expect(sw).toBeChecked();
      await toggle.click();
      await expect(sw).not.toBeChecked();
    }
  }

  async expectNavigationActionLinks(count: number): Promise<void> {
    const container = this.page.locator('[data-testid="chatbot-navigation-action"]');
    await expect(container).toBeVisible();
    await expect(container.locator('[data-testid^="chatbot-navigation-action-link-"]')).toHaveCount(count);
  }

  async expectNavigationActionsHidden(): Promise<void> {
    await expect(this.page.locator('[data-testid="chatbot-navigation-action"]')).toHaveCount(0);
  }

  async clickNewChat(): Promise<void> {
    await this.chatbotVisible().getByRole('button', { name: 'Clear chat' }).click();
  }

  async expectNewChatModalOpen(): Promise<void> {
    await expect(this.newChatModal()).toBeVisible();
    await expect(this.newChatModal()).toContainText('Confirm chat deletion');
  }

  async expectNewChatModalClosed(): Promise<void> {
    await expect(this.newChatModal()).toHaveCount(0);
  }

  async expectEraseConversationMessage(): Promise<void> {
    await expect(this.newChatModal()).toContainText(
      'Are you sure you want to erase the current chat conversation and start a new chat?'
    );
  }

  async expectProviderChangeMessage(): Promise<void> {
    await expect(this.newChatModal()).toContainText('Changing the AI provider requires starting a new chat.');
  }

  async cancelNewChatModal(): Promise<void> {
    await this.getBySel('new-chat-cancel').click();
  }

  async closeNewChatModalWithX(): Promise<void> {
    await this.newChatModal().getByRole('button', { name: 'Close' }).click();
  }

  async confirmNewChatModal(): Promise<void> {
    await this.getBySel('new-chat-confirm').click();
  }

  async selectSecondProvider(providerName = SECOND_PROVIDER_NAME): Promise<void> {
    await this.page.locator('.pf-chatbot__header').locator('button.pf-v6-c-menu-toggle').first().click();
    await this.page
      .locator('.pf-v6-c-menu__group')
      .filter({ has: this.page.locator('.pf-v6-c-menu__group-title', { hasText: providerName }) })
      .locator('button.pf-v6-c-menu__item')
      .first()
      .click();
  }

  async expectHeaderShowsProvider(providerName: string): Promise<void> {
    await expect(this.page.locator('.pf-chatbot__header').locator('button.pf-v6-c-menu-toggle').first()).toContainText(
      providerName
    );
  }

  async expectRunningToolLabel(toolName: string): Promise<void> {
    const label = this.chatbotVisible().locator(`[data-test="ai-tool-label-${toolName}"]`);
    await expect(label).toBeVisible();
    await expect(label.locator('.pf-v6-c-spinner')).toBeVisible();
  }

  async expectCompletedToolLabel(toolName: string): Promise<void> {
    const label = this.chatbotVisible().locator(`[data-test="ai-tool-label-${toolName}"]`);
    await expect(label).toBeVisible();
    await expect(label).not.toHaveClass(/pf-m-red/);
    await expect(label.locator('.pf-v6-c-spinner')).toHaveCount(0);
  }

  async expectErrorToolLabel(toolName: string): Promise<void> {
    const label = this.chatbotVisible().locator(`[data-test="ai-tool-label-${toolName}"]`);
    await expect(label).toBeVisible();
    await expect(label).toHaveClass(/pf-m-red/);
  }

  async clickToolLabel(toolName: string): Promise<void> {
    await this.chatbotVisible().locator(`[data-test="ai-tool-label-${toolName}"]`).click();
  }

  async expectToolModalOpen(): Promise<void> {
    await expect(this.toolModal()).toBeVisible();
  }

  async expectToolModalStatus(status: string): Promise<void> {
    await expect(this.toolModal()).toContainText(status);
  }

  async expectToolModalOutput(): Promise<void> {
    await expect(this.toolModal().locator('code')).not.toBeEmpty();
  }

  async expectToolModalArgsContain(text: string): Promise<void> {
    await expect(this.toolModal()).toContainText(text);
  }

  async expectFileAttachmentLabel(label: string): Promise<void> {
    await expect(this.chatbotVisible().locator('.pf-chatbot__file-label-contents', { hasText: label })).toBeVisible();
  }

  async openYamlAttachment(fileName: string): Promise<void> {
    const baseName = fileName.lastIndexOf('.') > 0 ? fileName.slice(0, fileName.lastIndexOf('.')) : fileName;
    await this.chatbotVisible()
      .locator('button.pf-m-clickable')
      .filter({ has: this.page.locator('.pf-chatbot__file-label-contents', { hasText: baseName }) })
      .first()
      .click();
  }

  async expectYamlModalOpen(): Promise<void> {
    await expect(this.yamlModal()).toBeVisible();
  }

  async expectYamlModalClosed(): Promise<void> {
    await expect(this.yamlModal()).toHaveCount(0);
  }

  async expectYamlModalEditorContains(snippet: string): Promise<void> {
    await expect(this.yamlModal().locator('.monaco-editor .view-lines')).toContainText(snippet);
  }

  async closeYamlModal(): Promise<void> {
    // Footer link and header X both expose name "Close"; prefer the footer dismiss control.
    await this.yamlModal().getByRole('contentinfo').getByRole('button', { name: 'Close' }).click();
  }

  async confirmYamlCreate(): Promise<void> {
    await expect(this.yamlModal()).toBeVisible();
    await this.yamlModal().getByRole('button', { name: 'Create' }).click();
  }

  async confirmYamlPatch(): Promise<void> {
    await expect(this.yamlModal()).toBeVisible();
    await this.yamlModal().getByRole('button', { name: 'Patch' }).click();
  }

  async confirmYamlDelete(): Promise<void> {
    await expect(this.yamlModal()).toBeVisible();
    await this.yamlModal().getByRole('button', { name: 'Delete' }).click();
  }

  async expectYamlApplySuccess(operation: 'create' | 'patch' | 'delete', resourceName: string): Promise<void> {
    const labels: Record<string, string> = {
      create: 'Successfully created',
      patch: 'Successfully patched',
      delete: 'Successfully deleted'
    };
    await expect(this.chatbotVisible()).toContainText(labels[operation]);
    await expect(this.chatbotVisible()).toContainText(resourceName);
  }

  async expectDangerErrorAlert(): Promise<void> {
    await expect(this.chatbotVisible().locator('.pf-v6-c-alert.pf-m-danger')).toBeVisible();
  }

  async openInteractionModeDropdown(): Promise<void> {
    await this.interactionModeToggle().click();
    await expect(this.page.locator('.pf-v6-c-menu')).toBeVisible();
  }

  async selectInteractionMode(mode: 'ask' | 'troubleshoot'): Promise<void> {
    const label = mode === 'ask' ? 'Ask' : 'Troubleshoot';
    await this.page.getByRole('menuitem', { name: label }).click();
  }

  async expectInteractionMode(mode: 'ask' | 'troubleshoot'): Promise<void> {
    const expected = mode === 'ask' ? 'Ask' : 'Troubleshoot';
    await expect(this.interactionModeToggle()).toContainText(expected);
  }

  async expectMessagePlaceholder(placeholder: string): Promise<void> {
    await expect(this.messageInput()).toHaveAttribute('placeholder', placeholder);
  }

  async expectInteractionModeOptionVisible(mode: 'ask' | 'troubleshoot'): Promise<void> {
    const text = mode === 'ask' ? 'Ask' : 'Troubleshoot';
    await expect(this.page.locator('.pf-v6-c-menu')).toContainText(text);
  }

  async expectInteractionModeDescription(description: string): Promise<void> {
    await expect(this.page.locator('.pf-v6-c-menu')).toContainText(description);
  }

  async viewIstioConfigList(namespaces: string): Promise<void> {
    await gotoConsolePage(this.page, 'istio', { namespaces });
    await this.getBySel('refresh-button').click();
    await waitForLoadingComplete(this.page);
  }

  async openVirtualServiceDetails(vsName: string, namespace: string): Promise<void> {
    await gotoConsolePage(this.page, `namespaces/${namespace}/istio/networking.istio.io/v1/VirtualService/${vsName}`);
    await waitForLoadingComplete(this.page);
    await expect(this.page.locator('[data-test="istio-config-editor"] .monaco-editor')).toBeVisible({
      timeout: 60_000
    });
  }

  virtualServiceRow(namespace: string, name: string): Locator {
    return this.page.locator(`[data-test*="_Ns${namespace}_VirtualService_${name}"]`);
  }
}
