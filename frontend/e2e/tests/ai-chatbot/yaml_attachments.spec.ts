import { expect } from '@playwright/test';
import { test } from '../../fixtures/kialiFixtures';
import {
  AI_CHATBOT_TEST_VS,
  fileCreateYamlPayload,
  fileDeleteYamlPayload,
  filePatchYamlPayload,
  multiFileActionsPayload
} from '../../utils/aiChatbotMocks';
import { expectIstioYamlApply, mockDestinationRuleCreate, type ChatRequestCapture } from '../../utils/aiChatbotHelpers';
import { applyVirtualService, deleteIstioConfig } from '../../utils/istioCrdValidation';
import { expectEditorMatchesRegex } from '../../utils/monacoEditor';
import { aiChatbotOnly } from '../../utils/suite-tags';

const BOOKINFO = 'bookinfo';

test.describe('AI chatbot YAML attachments', () => {
  // create/patch/delete share vs-ai-pw; parallel workers race on kubectl apply/delete
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ overviewPage }) => {
    await overviewPage.open();
  });

  test.afterEach(() => {
    deleteIstioConfig('VirtualService', AI_CHATBOT_TEST_VS, BOOKINFO);
  });

  test(
    'The AI chatbot renders multiple file attachments when the end event contains multiple actions',
    aiChatbotOnly,
    async ({ aiChatbotPage }) => {
      await aiChatbotPage.open();
      await aiChatbotPage.sendMessage('Apply traffic shifting for the reviews service', multiFileActionsPayload);
      await aiChatbotPage.expectFileAttachmentLabel('dr_reviews');
      await aiChatbotPage.expectFileAttachmentLabel('vs_reviews');
    }
  );

  test(
    'The AI chatbot file attachment modal shows the YAML content and can be dismissed',
    aiChatbotOnly,
    async ({ aiChatbotPage }) => {
      await aiChatbotPage.open();
      await aiChatbotPage.sendMessage('Apply traffic shifting for the reviews service', multiFileActionsPayload);
      await aiChatbotPage.openYamlAttachment('dr_reviews.yaml');
      await aiChatbotPage.expectYamlModalOpen();
      await aiChatbotPage.expectYamlModalEditorContains('DestinationRule');
      await aiChatbotPage.closeYamlModal();
      await aiChatbotPage.expectYamlModalClosed();
    }
  );

  test(
    'The AI chatbot file attachment create button calls the API and adds a success message',
    aiChatbotOnly,
    async ({ page, aiChatbotPage }) => {
      await aiChatbotPage.open();
      await aiChatbotPage.sendMessage('Apply traffic shifting for the reviews service', multiFileActionsPayload);
      await aiChatbotPage.openYamlAttachment('dr_reviews.yaml');
      const capture: ChatRequestCapture = {};
      await mockDestinationRuleCreate(page, capture);
      const applyPromise = expectIstioYamlApply(
        page,
        'POST',
        '/api/namespaces/bookinfo/istio/networking.istio.io/v1/DestinationRule'
      );
      await aiChatbotPage.confirmYamlCreate();
      await applyPromise;
      expect(capture.method).toBe('POST');
      await aiChatbotPage.expectAnswerContains('Successfully created');
      await aiChatbotPage.expectYamlModalClosed();
    }
  );

  test(
    'The AI chatbot YAML attachment triggers Istio VirtualService create',
    aiChatbotOnly,
    async ({ page, aiChatbotPage }) => {
      deleteIstioConfig('VirtualService', AI_CHATBOT_TEST_VS, BOOKINFO);
      await aiChatbotPage.open();
      await aiChatbotPage.sendMessage('Create a VirtualService for reviews in bookinfo', fileCreateYamlPayload);
      await aiChatbotPage.expectAnswerContains('Here is a VirtualService you can create in bookinfo.');
      await aiChatbotPage.openYamlAttachment('vs-ai-pw.yaml');
      const applyPromise = expectIstioYamlApply(
        page,
        'POST',
        '/api/namespaces/bookinfo/istio/networking.istio.io/v1/VirtualService'
      );
      await aiChatbotPage.confirmYamlCreate();
      await applyPromise;
      await aiChatbotPage.expectYamlApplySuccess('create', AI_CHATBOT_TEST_VS);
      await aiChatbotPage.viewIstioConfigList(BOOKINFO);
      await expect(aiChatbotPage.virtualServiceRow(BOOKINFO, AI_CHATBOT_TEST_VS)).toBeVisible({
        timeout: 45_000
      });
    }
  );

  test(
    'The AI chatbot YAML attachment triggers Istio VirtualService patch',
    aiChatbotOnly,
    async ({ page, aiChatbotPage }) => {
      applyVirtualService(AI_CHATBOT_TEST_VS, BOOKINFO, 'main', 'reviews');
      await aiChatbotPage.open();
      await aiChatbotPage.sendMessage('Patch the reviews VirtualService timeout in bookinfo', filePatchYamlPayload);
      await aiChatbotPage.expectAnswerContains('Apply this patch to the existing VirtualService.');
      await aiChatbotPage.openYamlAttachment('vs-ai-pw.yaml');
      const applyPromise = expectIstioYamlApply(
        page,
        'PATCH',
        `/api/namespaces/bookinfo/istio/networking.istio.io/v1/VirtualService/${AI_CHATBOT_TEST_VS}`
      );
      await aiChatbotPage.confirmYamlPatch();
      await applyPromise;
      await aiChatbotPage.expectYamlApplySuccess('patch', AI_CHATBOT_TEST_VS);
      await aiChatbotPage.openVirtualServiceDetails(AI_CHATBOT_TEST_VS, BOOKINFO);
      await expectEditorMatchesRegex(page, 'timeout: 2s');
    }
  );

  test(
    'The AI chatbot YAML attachment triggers Istio VirtualService delete',
    aiChatbotOnly,
    async ({ page, aiChatbotPage }) => {
      applyVirtualService(AI_CHATBOT_TEST_VS, BOOKINFO, 'main', 'reviews');
      await aiChatbotPage.open();
      await aiChatbotPage.sendMessage('Delete the reviews VirtualService in bookinfo', fileDeleteYamlPayload);
      await aiChatbotPage.expectAnswerContains('Confirm deletion of this VirtualService.');
      await aiChatbotPage.openYamlAttachment('vs-ai-pw.yaml');
      const applyPromise = expectIstioYamlApply(
        page,
        'DELETE',
        `/api/namespaces/bookinfo/istio/networking.istio.io/v1/VirtualService/${AI_CHATBOT_TEST_VS}`
      );
      await aiChatbotPage.confirmYamlDelete();
      await applyPromise;
      await aiChatbotPage.expectYamlApplySuccess('delete', AI_CHATBOT_TEST_VS);
      await aiChatbotPage.viewIstioConfigList(BOOKINFO);
      await aiChatbotPage.getBySel('refresh-button').click();
      await expect(aiChatbotPage.virtualServiceRow(BOOKINFO, AI_CHATBOT_TEST_VS)).toHaveCount(0);
    }
  );
});
