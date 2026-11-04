import { Button, Card, CardBody, CardHeader, CardTitle, Label, Tooltip } from '@patternfly/react-core';
import { EyeIcon, EyeSlashIcon, InfoCircleIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { ChatAIActions } from 'actions/ChatAIActions';
import { useKialiDispatch } from 'hooks/redux';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { PF_THEME_DARK, PF_THEME_FELT } from 'types/Common';
import type { TroubleshootingIssue } from 'types/Chatbot';
import { t } from 'utils/I18nUtils';
import { TroubleshootingSubProblemCard } from './TroubleshootingSubProblemCard';

const issueCardStyle = kialiStyle({
  backgroundColor: 'var(--pf-t--color--gray--10)',
  $nest: {
    [`.${PF_THEME_DARK} &, .${PF_THEME_FELT} &`]: {
      backgroundColor: 'var(--pf-t--color--gray--60)'
    }
  }
});

const headerStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: PFSpacer.sm
});

const headerActionsStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex'
});

const subProblemsStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  gap: PFSpacer.md
});

export const TroubleshootingIssueCard: React.FC<{ hidden?: boolean; issue: TroubleshootingIssue }> = ({
  hidden = false,
  issue
}) => {
  const dispatch = useKialiDispatch();
  const subProblems = issue.subProblems ?? [];
  const hideLabel = hidden ? t('Show this problem') : t('Hide this problem');

  const handleToggleHidden = (): void => {
    const payload = { id: issue.id, subProblemIds: subProblems.map(subProblem => subProblem.id) };
    dispatch(
      hidden ? ChatAIActions.showTroubleshootingIssue(payload) : ChatAIActions.hideTroubleshootingIssue(payload)
    );
  };

  return (
    <Card className={issueCardStyle} data-test="ai-troubleshooting-issue">
      <CardHeader
        actions={{
          actions: (
            <div className={headerActionsStyle}>
              <Tooltip content={hideLabel}>
                <Button
                  aria-label={hideLabel}
                  data-test={hidden ? 'ai-troubleshooting-show-issue' : 'ai-troubleshooting-hide-issue'}
                  icon={hidden ? <EyeIcon /> : <EyeSlashIcon />}
                  onClick={handleToggleHidden}
                  variant="plain"
                />
              </Tooltip>
            </div>
          ),
          hasNoOffset: true
        }}
      >
        <CardTitle>
          <div className={headerStyle}>
            <span>{`[${issue.id}] ${issue.problem}`}</span>
            <Label isCompact>{issue.category}</Label>
            {issue.description && (
              <Tooltip content={issue.description}>
                <Button aria-label={t('Issue description')} icon={<InfoCircleIcon />} variant="plain" />
              </Tooltip>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      {subProblems.length > 0 && (
        <CardBody>
          <div className={subProblemsStyle}>
            {subProblems.map(subProblem => (
              <TroubleshootingSubProblemCard key={subProblem.id} subProblem={subProblem} />
            ))}
          </div>
        </CardBody>
      )}
    </Card>
  );
};
