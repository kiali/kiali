import {
  Button,
  Divider,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Tooltip
} from '@patternfly/react-core';
import { OptimizeIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { ChatAIActions } from 'actions/ChatAIActions';
import type { KialiAppState } from 'store/Store';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { t } from 'utils/I18nUtils';
import { TroubleshootingAnalysis } from './TroubleshootingAnalysis';

const separatorStyle = kialiStyle({
  marginBottom: PFSpacer.md,
  marginTop: PFSpacer.md
});

const footerStyle = kialiStyle({
  alignItems: 'flex-end',
  display: 'flex',
  gap: PFSpacer.sm
});

export type TroubleshootingAnalyzeProps = {
  children?: React.ReactNode;
  description?: React.ReactNode;
  prompt: string;
  title?: string;
  titleIconVariant?: 'custom' | 'danger' | 'info' | 'success' | 'warning';
};

const isAnalyzeAllowed = (state: KialiAppState): boolean => {
  const troubleshooting = state.ai.troubleshooting;
  return Boolean(
    state.ai.enabled &&
    troubleshooting?.enabled &&
    troubleshooting?.allowed &&
    troubleshooting?.ai_support?.enabled &&
    troubleshooting?.ai_support?.allowed
  );
};

export const TroubleshootingAnalyze: React.FC<TroubleshootingAnalyzeProps> = ({
  children,
  description,
  prompt,
  title,
  titleIconVariant
}) => {
  const dispatch = useDispatch();
  const analyzeAllowed = useSelector(isAnalyzeAllowed);
  const [open, setOpen] = React.useState(false);
  const [run, setRun] = React.useState(0);
  const openRef = React.useRef(open);
  openRef.current = open;

  const canOpen = analyzeAllowed && prompt.trim() !== '';
  const heading = title?.trim() ? title : t('Troubleshooting');

  const close = (): void => {
    setOpen(false);
    dispatch(ChatAIActions.setTroubleshootingAnalysisOpen(false));
  };

  const handleOpen = (): void => {
    if (!canOpen) {
      return;
    }
    dispatch(ChatAIActions.setTroubleshootingAnalysisOpen(true));
    setRun(current => current + 1);
    setOpen(true);
  };

  React.useEffect(() => {
    return () => {
      if (openRef.current) {
        dispatch(ChatAIActions.setTroubleshootingAnalysisOpen(false));
      }
    };
  }, [dispatch]);

  return (
    <>
      <Tooltip content={canOpen ? prompt : t('AI troubleshooting is not available')}>
        <span>
          <Button
            aria-label={t('Analyze')}
            data-test="ai-troubleshooting-analyze"
            icon={<OptimizeIcon />}
            isDisabled={!canOpen}
            onClick={handleOpen}
            size="sm"
            variant="secondary"
          >
            {t('Analyze')}
          </Button>
        </span>
      </Tooltip>
      {open && (
        <TroubleshootingAnalysis key={run} query={prompt}>
          {({ composer, thread }) => (
            <Modal
              aria-labelledby="ai-troubleshooting-analysis-title"
              data-test="ai-troubleshooting-analysis-modal"
              isOpen
              onClose={close}
              variant={ModalVariant.large}
            >
              <ModalHeader
                description={description}
                labelId="ai-troubleshooting-analysis-title"
                title={heading}
                titleIconVariant={titleIconVariant}
              />
              <ModalBody>
                {children && (
                  <>
                    {children}
                    <Divider className={separatorStyle} data-test="ai-troubleshooting-analysis-separator" />
                  </>
                )}
                {thread}
              </ModalBody>
              <ModalFooter className={footerStyle}>
                {composer}
                <Button data-test="ai-troubleshooting-analysis-cancel" onClick={close} variant="link">
                  {t('Cancel')}
                </Button>
              </ModalFooter>
            </Modal>
          )}
        </TroubleshootingAnalysis>
      )}
    </>
  );
};
