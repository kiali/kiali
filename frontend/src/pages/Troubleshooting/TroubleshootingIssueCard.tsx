import {
  Button,
  Card,
  CardBody,
  CardExpandableContent,
  CardHeader,
  CardTitle,
  Label,
  Tooltip
} from '@patternfly/react-core';
import { EyeIcon, EyeSlashIcon, InfoCircleIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { ChatAIActions } from 'actions/ChatAIActions';
import { KialiIcon } from 'config/KialiIcon';
import { useKialiDispatch } from 'hooks/redux';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { PF_THEME_DARK, PF_THEME_FELT } from 'types/Common';
import type { TroubleshootingIssue } from 'types/Chatbot';
import { t } from 'utils/I18nUtils';
import { summarizeTroubleshootingIssues } from './partitionTroubleshooting';
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
  display: 'flex',
  gap: PFSpacer.sm
});

const severityCountStyle = kialiStyle({
  alignItems: 'center',
  display: 'inline-flex',
  gap: PFSpacer.xs
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
  const [isExpanded, setIsExpanded] = React.useState(true);
  const subProblems = issue.subProblems ?? [];
  const hideLabel = hidden ? t('Show this problem') : t('Hide this problem');
  const counts = React.useMemo(() => summarizeTroubleshootingIssues([issue]), [issue]);

  const handleToggleHidden = (): void => {
    const payload = { id: issue.id, subProblemIds: subProblems.map(subProblem => subProblem.id) };
    dispatch(
      hidden ? ChatAIActions.showTroubleshootingIssue(payload) : ChatAIActions.hideTroubleshootingIssue(payload)
    );
  };

  return (
    <Card className={issueCardStyle} data-test="ai-troubleshooting-issue" isExpanded={isExpanded}>
      <CardHeader
        onExpand={subProblems.length > 0 ? () => setIsExpanded(prev => !prev) : undefined}
        toggleButtonProps={
          subProblems.length > 0
            ? {
                'aria-label': t('Toggle problem details'),
                'data-test': 'ai-troubleshooting-issue-toggle'
              }
            : undefined
        }
        actions={{
          actions: (
            <div className={headerActionsStyle}>
              {counts.critical > 0 && (
                <span className={severityCountStyle} data-test="ai-troubleshooting-issue-critical-count">
                  <KialiIcon.ExclamationCircle status="danger" />
                  <span>{counts.critical}</span>
                </span>
              )}
              {counts.warning > 0 && (
                <span className={severityCountStyle} data-test="ai-troubleshooting-issue-warning-count">
                  <KialiIcon.ExclamationTriangle status="warning" />
                  <span>{counts.warning}</span>
                </span>
              )}
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
            <Tooltip content={issue.id}>
              <span>{issue.problem}</span>
            </Tooltip>
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
        <CardExpandableContent>
          <CardBody>
            <div className={subProblemsStyle}>
              {subProblems.map(subProblem => (
                <TroubleshootingSubProblemCard key={subProblem.id} subProblem={subProblem} />
              ))}
            </div>
          </CardBody>
        </CardExpandableContent>
      )}
    </Card>
  );
};
