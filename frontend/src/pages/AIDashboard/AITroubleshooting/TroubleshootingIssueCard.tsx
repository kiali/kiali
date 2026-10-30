import { Button, Card, CardBody, CardHeader, CardTitle, Label, Tooltip } from '@patternfly/react-core';
import { InfoCircleIcon } from '@patternfly/react-icons';
import * as React from 'react';
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

const subProblemsStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  gap: PFSpacer.md
});

export const TroubleshootingIssueCard: React.FC<{ issue: TroubleshootingIssue }> = ({ issue }) => {
  const subProblems = issue.subProblems ?? [];

  return (
    <Card className={issueCardStyle} data-test="ai-troubleshooting-issue">
      <CardHeader>
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
