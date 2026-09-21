import { test } from '../../fixtures/kialiFixtures';
import { cancelledStreamPayload, mockPayload } from '../../utils/aiChatbotMocks';
import { aiChatbotOnly } from '../../utils/suite-tags';

test.describe('AI chatbot messaging', () => {
  test.beforeEach(async ({ overviewPage }) => {
    await overviewPage.open();
  });

  test(
    'The AI chatbot shows a cancelled alert when the user stops the stream',
    aiChatbotOnly,
    async ({ aiChatbotPage }) => {
      await aiChatbotPage.open();
      await aiChatbotPage.sendMessageStreamNoEnd('Tell me about Istio', cancelledStreamPayload);
      await aiChatbotPage.expectStopButtonVisible();
      await aiChatbotPage.clickStop();
      await aiChatbotPage.expectCancelledAlert();
    }
  );

  test('The AI chatbot responds with sources', aiChatbotOnly, async ({ aiChatbotPage }) => {
    await aiChatbotPage.open();
    await aiChatbotPage.sendMessage(
      'Could you explain what a VirtualService is and point me to the relevant documentation?'
    );
    await aiChatbotPage.expectSourcesCard(mockPayload.referenced_docs.length);
  });
});
