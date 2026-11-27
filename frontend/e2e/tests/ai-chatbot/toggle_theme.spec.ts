import { expect } from '@playwright/test';
import { test } from '../../fixtures/kialiFixtures';
import { mockChatbotNotAllowed } from '../../utils/aiChatbotHelpers';
import { aiChatbotOnly } from '../../utils/suite-tags';

test.describe('AI chatbot toggle and theme', () => {
  test.beforeEach(async ({ overviewPage }) => {
    await overviewPage.open();
  });

  test(
    'Changing display mode updates the chatbot layout class and CSS variables',
    aiChatbotOnly,
    async ({ aiChatbotPage }) => {
      await aiChatbotPage.open();
      await aiChatbotPage.clickDock();
      await aiChatbotPage.expectDisplayMode('docked');
      await aiChatbotPage.expectDockedHeightCssVariable();
      await aiChatbotPage.clickOverlay();
      await aiChatbotPage.expectDisplayMode('default');
    }
  );

  test('The Minimize button hides the chatbot', aiChatbotOnly, async ({ aiChatbotPage }) => {
    await aiChatbotPage.open();
    await aiChatbotPage.clickMinimize();
    await aiChatbotPage.expectClosed();
  });

  test('The chatbot toggle icon reflects the active theme', aiChatbotOnly, async ({ aiChatbotPage }) => {
    await aiChatbotPage.ensureLightTheme();
    await aiChatbotPage.expectLightThemeToggleIcon();
    await aiChatbotPage.switchToDarkTheme();
    await aiChatbotPage.expectDarkThemeToggleIcon();
    await aiChatbotPage.switchToLightTheme();
    await aiChatbotPage.expectLightThemeToggleIcon();
  });

  test('The AI chatbot toggle button is visible', aiChatbotOnly, async ({ aiChatbotPage }) => {
    await aiChatbotPage.expectToggleVisible();
  });

  test('The AI chatbot can be opened', aiChatbotOnly, async ({ aiChatbotPage }) => {
    await aiChatbotPage.clickToggle();
    await aiChatbotPage.expectOpen();
  });

  test('The AI chatbot can be closed', aiChatbotOnly, async ({ aiChatbotPage }) => {
    await aiChatbotPage.open();
    await aiChatbotPage.clickToggle();
    await aiChatbotPage.expectClosed();
  });

  test('The AI chatbot shows a welcome message', aiChatbotOnly, async ({ aiChatbotPage }) => {
    await aiChatbotPage.open();
    await aiChatbotPage.expectWelcomeMessage();
  });

  test(
    'The AI chatbot toggle is disabled and warns the user when they are not allowed to use it',
    aiChatbotOnly,
    async ({ page, aiChatbotPage }) => {
      await mockChatbotNotAllowed(page);
      await page.reload();
      await aiChatbotPage.expectToggleVisible();

      await aiChatbotPage.toggle().hover();
      await expect(page.locator('.pf-v6-c-tooltip__content')).toContainText('Chatbot is not allowed for this user');

      await aiChatbotPage.clickToggle();
      await aiChatbotPage.expectClosed();
    }
  );
});
