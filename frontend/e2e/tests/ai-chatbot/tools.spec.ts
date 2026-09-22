import { test } from '../../fixtures/kialiFixtures';
import {
  toolErrorPayload,
  toolRunningPayload,
  toolSuccessPayload,
  toolWithArgsPayload
} from '../../utils/aiChatbotMocks';
import { aiChatbotOnly } from '../../utils/suite-tags';

test.describe('AI chatbot tools', () => {
  test.beforeEach(async ({ overviewPage }) => {
    await overviewPage.open();
  });

  test(
    'The AI chatbot renders a tool call label while the tool is running',
    aiChatbotOnly,
    async ({ aiChatbotPage }) => {
      await aiChatbotPage.open();
      await aiChatbotPage.sendMessage('What is the mesh status?', toolRunningPayload);
      await aiChatbotPage.expectRunningToolLabel('get_mesh_status');
    }
  );

  test('The AI chatbot renders a completed tool call with success icon', aiChatbotOnly, async ({ aiChatbotPage }) => {
    await aiChatbotPage.open();
    await aiChatbotPage.sendMessage('What is the mesh status?', toolSuccessPayload);
    await aiChatbotPage.expectCompletedToolLabel('get_mesh_status');
  });

  test('The AI chatbot renders a failed tool call with error icon', aiChatbotOnly, async ({ aiChatbotPage }) => {
    await aiChatbotPage.open();
    await aiChatbotPage.sendMessage('Get the application logs', toolErrorPayload);
    await aiChatbotPage.expectErrorToolLabel('get_logs');
  });

  test(
    'The AI chatbot tool modal shows pending state when tool is still running',
    aiChatbotOnly,
    async ({ aiChatbotPage }) => {
      await aiChatbotPage.open();
      await aiChatbotPage.sendMessage('What is the mesh status?', toolRunningPayload);
      await aiChatbotPage.expectRunningToolLabel('get_mesh_status');
      await aiChatbotPage.clickToolLabel('get_mesh_status');
      await aiChatbotPage.expectToolModalOpen();
      await aiChatbotPage.expectToolModalStatus('pending');
    }
  );

  test(
    'The AI chatbot tool modal shows result content after tool completion',
    aiChatbotOnly,
    async ({ aiChatbotPage }) => {
      await aiChatbotPage.open();
      await aiChatbotPage.sendMessage('What is the mesh status?', toolSuccessPayload);
      await aiChatbotPage.expectCompletedToolLabel('get_mesh_status');
      await aiChatbotPage.clickToolLabel('get_mesh_status');
      await aiChatbotPage.expectToolModalOpen();
      await aiChatbotPage.expectToolModalStatus('success');
      await aiChatbotPage.expectToolModalOutput();
    }
  );

  test('The AI chatbot tool modal displays tool arguments', aiChatbotOnly, async ({ aiChatbotPage }) => {
    await aiChatbotPage.open();
    await aiChatbotPage.sendMessage('List services in bookinfo', toolWithArgsPayload);
    await aiChatbotPage.expectCompletedToolLabel('list_or_get_resources');
    await aiChatbotPage.clickToolLabel('list_or_get_resources');
    await aiChatbotPage.expectToolModalOpen();
    await aiChatbotPage.expectToolModalArgsContain('namespaces=bookinfo');
  });
});
