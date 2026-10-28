import { Button, Tooltip } from '@patternfly/react-core';
import { OptimizeIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { useSelector } from 'react-redux';

import { isTroubleshootingAnalyzeAllowed, useTroubleshootingDrawer } from 'hooks/useTroubleshootingDrawer';
import type { TroubleshootingSubProblem } from 'types/Chatbot';
import { t } from 'utils/I18nUtils';

export type TroubleshootingAnalyzeProps = {
  description?: string;
  problem: string;
  prompt: string;
  subProblem?: TroubleshootingSubProblem;
};

export const TroubleshootingAnalyze: React.FC<TroubleshootingAnalyzeProps> = ({
  description,
  problem,
  prompt,
  subProblem
}) => {
  const analyzeAllowed = useSelector(isTroubleshootingAnalyzeAllowed);
  const { start } = useTroubleshootingDrawer();
  const canOpen = analyzeAllowed && prompt.trim() !== '';
  const heading = problem.trim() ? problem : t('Troubleshooting');

  const handleOpen = (): void => {
    if (!canOpen) {
      return;
    }
    start({
      description,
      problem: heading,
      prompt,
      subProblem
    });
  };

  return (
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
  );
};
