import * as React from 'react';
import { Content, Label, ToolbarItem, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { ExclamationCircleIcon, ExclamationTriangleIcon } from '@patternfly/react-icons';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom-v5-compat';

import { Paths } from 'config';
import { KialiLink } from 'components/Link/KialiLink';
import { meshLinkStyle } from 'components/IstioStatus/IstioStatus';
import { PFColors } from 'components/Pf/PfColors';
import {
  summarizeTroubleshootingIssues,
  troubleshootingDetail
} from 'pages/AIDashboard/AITroubleshooting/partitionTroubleshooting';
import type { KialiAppState } from 'store/Store';
import { PFSpacer } from 'styles/PfSpacer';
import { PFFontSize, PFFontWeight } from 'styles/PfTypography';
import { kialiStyle } from 'styles/StyleUtils';
import type { TroubleshootingIssue } from 'types/Chatbot';
import { t } from 'utils/I18nUtils';

const ISSUE_COUNT_THRESHOLD = 3;

const centerItemStyle = kialiStyle({
  alignSelf: 'center'
});

const headerStyle = kialiStyle({
  fontSize: PFFontSize.default,
  fontWeight: PFFontWeight.HeadingDefault,
  marginBottom: PFSpacer.xs
});

const summaryStyle = kialiStyle({
  marginBottom: PFSpacer.sm,
  textAlign: 'left'
});

const issueRowStyle = kialiStyle({
  alignItems: 'flex-start',
  display: 'flex',
  gap: PFSpacer.xs,
  marginBottom: PFSpacer.xs,
  textAlign: 'left'
});

const criticalIconStyle = kialiStyle({
  color: PFColors.Danger,
  flexShrink: 0,
  marginTop: PFSpacer.xs
});

const warningIconStyle = kialiStyle({
  color: PFColors.Warning,
  flexShrink: 0,
  marginTop: PFSpacer.xs
});

const tooltipStyle = kialiStyle({
  $nest: {
    '& .pf-v6-c-tooltip__content': {
      backgroundColor: PFColors.BackgroundColor100,
      color: 'var(--pf-t--global--text--color--primary--default)'
    },
    '& .pf-v6-c-tooltip__arrow': {
      backgroundColor: PFColors.BackgroundColor100,
      $nest: {
        '&::before': {
          borderTopColor: PFColors.BackgroundColor100,
          borderBottomColor: PFColors.BackgroundColor100,
          borderLeftColor: PFColors.BackgroundColor100,
          borderRightColor: PFColors.BackgroundColor100
        }
      }
    }
  }
});

const issueIsCritical = (issue: TroubleshootingIssue): boolean =>
  (issue.subProblems ?? []).some(subProblem => subProblem.severity === 'critical');

export const TroubleshootingStatus: React.FC = () => {
  const { pathname } = useLocation();
  const [tooltipNonce, setTooltipNonce] = React.useState(0);
  const troubleshooting = useSelector((state: KialiAppState) => state.ai.troubleshooting);
  const allowed = !!(troubleshooting?.enabled && troubleshooting.allowed && troubleshooting.loaded);
  const issues = troubleshooting?.issues ?? [];
  const summary = summarizeTroubleshootingIssues(issues);

  if (!allowed || summary.problems === 0) {
    return null;
  }

  const critical = summary.critical > 0;
  const status: 'danger' | 'warning' = critical ? 'danger' : 'warning';
  const dataTest = critical ? 'troubleshooting-status-danger' : 'troubleshooting-status-warning';
  const displayedIssues = issues.slice(0, ISSUE_COUNT_THRESHOLD);

  const tooltipContent = (
    <Content>
      <Content className={headerStyle}>{t('Troubleshooting')}</Content>
      <Content className={summaryStyle}>{troubleshootingDetail(summary)}</Content>
      {displayedIssues.map(issue => {
        const isCritical = issueIsCritical(issue);
        return (
          <div className={issueRowStyle} key={issue.id}>
            {isCritical ? (
              <ExclamationCircleIcon aria-hidden className={criticalIconStyle} />
            ) : (
              <ExclamationTriangleIcon aria-hidden className={warningIconStyle} />
            )}
            <span>{issue.problem}</span>
          </div>
        );
      })}
      {!pathname.endsWith(`/${Paths.AI}`) && (
        <div className={meshLinkStyle}>
          <span>{t('More info at')}</span>
          <KialiLink
            dataTest="troubleshooting-status-link"
            onClick={() => setTooltipNonce(prev => prev + 1)}
            to={`/${Paths.AI}?tab=troubleshooting`}
          >
            {t('Troubleshooting page')}
          </KialiLink>
        </div>
      )}
    </Content>
  );

  return (
    <ToolbarItem className={centerItemStyle}>
      <Tooltip
        className={tooltipStyle}
        content={tooltipContent}
        data-test="troubleshooting-status-tooltip"
        enableFlip={true}
        key={`${pathname}-${tooltipNonce}`}
        maxWidth="25rem"
        position={TooltipPosition.top}
      >
        <Label data-test={dataTest} status={status}>
          {t('Troubleshooting')}
        </Label>
      </Tooltip>
    </ToolbarItem>
  );
};
