import {
  Bullseye,
  EmptyState,
  EmptyStateBody,
  ExpandableSection,
  Spinner,
  Title,
  TitleSizes
} from '@patternfly/react-core';
import * as React from 'react';
import { useSelector } from 'react-redux';
import { Refresh } from 'components/Refresh/Refresh';
import { ManualRefreshEmptyState } from 'components/Refresh/ManualRefreshEmptyState';
import { useKialiDispatch } from 'hooks/redux';
import { useManualRefreshState, useRefreshInterval } from 'hooks/refresh';
import { loadTroubleshootingScan } from 'services/AiTroubleshooting';
import type { KialiAppState } from 'store/Store';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { t } from 'utils/I18nUtils';
import { writeHiddenSubProblemIds } from 'utils/TroubleshootingStorage';
import {
  hiddenProblemsTitle,
  partitionTroubleshootingIssues,
  summarizeTroubleshootingIssues,
  troubleshootingDetectedTitle
} from './partitionTroubleshooting';
import { TroubleshootingIssueCard } from './TroubleshootingIssueCard';

const pageStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column'
});

const toolbarStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  flexShrink: 0,
  gap: PFSpacer.md,
  justifyContent: 'space-between',
  marginBottom: PFSpacer.md
});

const summaryStyle = kialiStyle({
  marginBottom: 0,
  marginTop: 0
});

const refreshSlotStyle = kialiStyle({
  flexShrink: 0,
  marginLeft: 'auto'
});

const hiddenSectionStyle = kialiStyle({
  $nest: {
    '& .pf-v6-c-expandable-section__toggle': {
      marginBottom: 0,
      marginTop: 0
    },
    // Match the main "Troubleshooting: N problems detected" title, and keep the caret as the click target.
    '& .pf-v6-c-expandable-section__toggle .pf-v6-c-button': {
      color: 'var(--pf-t--global--text--color--regular)',
      fontFamily: 'var(--pf-t--global--font--family--heading)',
      fontSize: 'var(--pf-t--global--font--size--heading--sm)',
      fontWeight: 'var(--pf-t--global--font--weight--heading--default)',
      lineHeight: 'var(--pf-t--global--font--line-height--heading)',
      padding: 0,
      textDecoration: 'none'
    },
    '& .pf-v6-c-expandable-section__toggle .pf-v6-c-button:hover, & .pf-v6-c-expandable-section__toggle .pf-v6-c-button:focus':
      {
        color: 'var(--pf-t--global--text--color--regular)',
        textDecoration: 'none'
      },
    '& .pf-v6-c-expandable-section__toggle-icon': {
      color: 'var(--pf-t--global--icon--color--regular)',
      fontSize: 'var(--pf-t--global--font--size--heading--sm)'
    }
  }
});

const hiddenIssuesStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  gap: PFSpacer.md,
  marginTop: PFSpacer.sm
});

const issuesStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  gap: PFSpacer.md
});

export const AITroubleshooting: React.FC = () => {
  const dispatch = useKialiDispatch();
  const loaded = useManualRefreshState();
  const { lastRefreshAt } = useRefreshInterval();
  const error = useSelector((state: KialiAppState) => state.ai.troubleshooting.error);
  const hiddenSubProblemIds = useSelector((state: KialiAppState) => state.ai.troubleshooting.hiddenSubProblemIds);
  const issues = useSelector((state: KialiAppState) => state.ai.troubleshooting.issues);
  const openAnalyses = useSelector((state: KialiAppState) => state.ai.troubleshooting.openAnalyses);
  const scanLoaded = useSelector((state: KialiAppState) => state.ai.troubleshooting.loaded);
  const [loading, setLoading] = React.useState(!scanLoaded && issues.length === 0);
  const [hiddenExpanded, setHiddenExpanded] = React.useState(false);

  React.useEffect(() => {
    if (!loaded || openAnalyses > 0) {
      return;
    }
    let cancelled = false;
    const load = async (): Promise<void> => {
      setLoading(true);
      await loadTroubleshootingScan(dispatch, () => !cancelled);
      if (!cancelled) {
        setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [dispatch, lastRefreshAt, loaded, openAnalyses]);

  React.useEffect(() => {
    writeHiddenSubProblemIds(hiddenSubProblemIds);
  }, [hiddenSubProblemIds]);

  const { hidden, visible } = React.useMemo(
    () => partitionTroubleshootingIssues(issues, hiddenSubProblemIds),
    [hiddenSubProblemIds, issues]
  );
  const hiddenSubproblemCount = hidden.reduce((total, issue) => total + issue.subProblems.length, 0);
  const showIssues = loaded && !error && !(loading && issues.length === 0) && issues.length > 0;

  const refreshToolbar = (
    <div className={toolbarStyle}>
      {showIssues && (
        <Title className={summaryStyle} data-test="ai-troubleshooting-summary" headingLevel="h2" size={TitleSizes.lg}>
          {troubleshootingDetectedTitle(summarizeTroubleshootingIssues(visible))}
        </Title>
      )}
      <div className={refreshSlotStyle}>
        <Refresh id="ai-troubleshooting-refresh" disabled={openAnalyses > 0} manageURL={true} />
      </div>
    </div>
  );

  let content: React.ReactNode;
  if (!loaded) {
    content = <ManualRefreshEmptyState />;
  } else if (loading && issues.length === 0) {
    content = (
      <Bullseye data-test="ai-troubleshooting-loading">
        <Spinner size="xl" />
      </Bullseye>
    );
  } else if (error) {
    content = (
      <EmptyState headingLevel="h4" titleText={t('Unable to load troubleshooting')}>
        <EmptyStateBody>{error}</EmptyStateBody>
      </EmptyState>
    );
  } else if (issues.length === 0) {
    content = (
      <EmptyState headingLevel="h4" titleText={t('No mesh issues found')}>
        <EmptyStateBody>{t('The mesh scan did not report any issues.')}</EmptyStateBody>
      </EmptyState>
    );
  } else {
    content = (
      <div className={issuesStyle} data-test="ai-troubleshooting">
        {visible.map(issue => (
          <TroubleshootingIssueCard issue={issue} key={`visible-${issue.id}`} />
        ))}
        {hiddenSubproblemCount > 0 && (
          <ExpandableSection
            className={hiddenSectionStyle}
            data-test="ai-troubleshooting-hidden"
            isExpanded={hiddenExpanded}
            onToggle={(_event, expanded) => setHiddenExpanded(expanded)}
            toggleId="ai-troubleshooting-hidden-toggle"
            toggleText={hiddenProblemsTitle(summarizeTroubleshootingIssues(hidden))}
            toggleWrapper="h2"
          >
            <div className={hiddenIssuesStyle}>
              {hidden.map(issue => (
                <TroubleshootingIssueCard issue={issue} key={`hidden-${issue.id}`} />
              ))}
            </div>
          </ExpandableSection>
        )}
      </div>
    );
  }

  return (
    <div className={pageStyle}>
      {refreshToolbar}
      {content}
    </div>
  );
};
