import { test } from '../../fixtures/kialiFixtures';
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
});
