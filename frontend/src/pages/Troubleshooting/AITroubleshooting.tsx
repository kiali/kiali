import {
  Bullseye,
  EmptyState,
  EmptyStateBody,
  ExpandableSection,
  Label,
  SearchInput,
  Spinner,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem
} from '@patternfly/react-core';
import { EyeSlashIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { ToolbarDropdown } from 'components/Dropdown/ToolbarDropdown';
import { PFColors } from 'components/Pf/PfColors';
import { Refresh } from 'components/Refresh/Refresh';
import { ManualRefreshEmptyState } from 'components/Refresh/ManualRefreshEmptyState';
import { KialiIcon } from 'config/KialiIcon';
import { useKialiDispatch, useKialiSelector } from 'hooks/redux';
import { useManualRefreshState, useRefreshInterval } from 'hooks/refresh';
import { loadTroubleshootingScan } from 'services/AiTroubleshooting';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { PFFontWeight } from 'styles/PfTypography';
import { t } from 'utils/I18nUtils';
import { writeHiddenSubProblemIds } from 'utils/TroubleshootingStorage';
import {
  filterAndGroupTroubleshootingIssues,
  hiddenProblemsTitle,
  partitionTroubleshootingIssues,
  summarizeTroubleshootingIssues,
  troubleshootingDetectedTitle,
  type TroubleshootingGroupBy,
  type TroubleshootingSeverityFilter
} from './partitionTroubleshooting';
import { TroubleshootingIssueCard } from './TroubleshootingIssueCard';

const pageStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column'
});

// Sticky filter bar for the standalone Troubleshooting page (full-bleed horizontally).
const toolbarStyle = kialiStyle({
  backgroundColor: PFColors.BackgroundColor100,
  marginBottom: PFSpacer.md,
  marginLeft: `calc(${PFSpacer.md} * -1)`,
  marginRight: `calc(${PFSpacer.md} * -1)`,
  paddingBottom: PFSpacer.sm,
  paddingLeft: PFSpacer.md,
  paddingRight: PFSpacer.md,
  paddingTop: PFSpacer.sm,
  position: 'sticky',
  top: 0,
  zIndex: 10,
  $nest: {
    // PatternFly Toolbar adds its own block padding; keep the bar flush under the masthead.
    '&.pf-v6-c-toolbar': {
      paddingBlockStart: 0,
      paddingBlockEnd: 0
    },
    '& .pf-v6-c-toolbar__content': {
      paddingBlockStart: 0,
      paddingBlockEnd: 0
    }
  }
});

const kpiGroupStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: PFSpacer.sm
});

const filterLabelStyle = kialiStyle({
  cursor: 'pointer'
});

const activeFilterLabelStyle = kialiStyle({
  cursor: 'pointer',
  fontWeight: PFFontWeight.BodyBold,
  outline: '2px solid var(--pf-t--global--border--color--clicked)'
});

const groupByLabelStyle = kialiStyle({
  marginRight: PFSpacer.sm,
  whiteSpace: 'nowrap'
});

const srOnlyStyle = kialiStyle({
  border: 0,
  clip: 'rect(0, 0, 0, 0)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px'
});

const hiddenSectionStyle = kialiStyle({
  $nest: {
    '& .pf-v6-c-expandable-section__toggle': {
      marginBottom: 0,
      marginTop: 0
    },
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
  const error = useKialiSelector(state => state.ai.troubleshooting.error);
  const hiddenSubProblemIds = useKialiSelector(state => state.ai.troubleshooting.hiddenSubProblemIds);
  const issues = useKialiSelector(state => state.ai.troubleshooting.issues);
  const scanLoaded = useKialiSelector(state => state.ai.troubleshooting.loaded);
  const [loading, setLoading] = React.useState(!scanLoaded && issues.length === 0);
  const [hiddenExpanded, setHiddenExpanded] = React.useState(false);
  const [severityFilter, setSeverityFilter] = React.useState<TroubleshootingSeverityFilter>('all');
  const [search, setSearch] = React.useState('');
  const [groupBy, setGroupBy] = React.useState<TroubleshootingGroupBy>('category');

  React.useEffect(() => {
    if (!loaded) {
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
  }, [dispatch, lastRefreshAt, loaded]);

  React.useEffect(() => {
    writeHiddenSubProblemIds(hiddenSubProblemIds);
  }, [hiddenSubProblemIds]);

  const { hidden, visible } = React.useMemo(
    () => partitionTroubleshootingIssues(issues, hiddenSubProblemIds),
    [hiddenSubProblemIds, issues]
  );

  const visibleSummary = React.useMemo(() => summarizeTroubleshootingIssues(visible), [visible]);
  const hiddenSummary = React.useMemo(() => summarizeTroubleshootingIssues(hidden), [hidden]);
  const hiddenSubproblemCount = hidden.reduce((total, issue) => total + issue.subProblems.length, 0);

  const displayedVisibleIssues = React.useMemo(
    () =>
      filterAndGroupTroubleshootingIssues(visible, {
        groupBy,
        search,
        severityFilter
      }),
    [groupBy, search, severityFilter, visible]
  );

  const showIssues = loaded && !error && !(loading && issues.length === 0) && issues.length > 0;

  const groupOptions = React.useMemo(
    () => ({
      category: t('Category'),
      namespace: t('Namespace'),
      severity: t('Severity')
    }),
    []
  );

  const toggleSeverityFilter = (target: 'critical' | 'warning'): void => {
    setSeverityFilter(prev => (prev === target ? 'all' : target));
  };

  const refreshToolbar = (
    <Toolbar className={toolbarStyle} id="ai-troubleshooting-toolbar">
      <ToolbarContent>
        {showIssues && (
          <>
            <ToolbarItem>
              <div className={kpiGroupStyle} data-test="ai-troubleshooting-summary">
                <span className={srOnlyStyle}>{troubleshootingDetectedTitle(visibleSummary)}</span>
                <Label
                  className={severityFilter === 'critical' ? activeFilterLabelStyle : filterLabelStyle}
                  icon={
                    <KialiIcon.ExclamationCircle color={severityFilter === 'critical' ? PFColors.White : undefined} />
                  }
                  isClickable
                  render={({ className, componentRef, content }) => (
                    <button
                      aria-pressed={severityFilter === 'critical'}
                      className={className}
                      data-test="ai-troubleshooting-filter-critical"
                      onClick={() => toggleSeverityFilter('critical')}
                      ref={componentRef}
                      type="button"
                    >
                      {content}
                    </button>
                  )}
                  status="danger"
                  variant={severityFilter === 'critical' ? 'filled' : 'outline'}
                >
                  {`${visibleSummary.critical} ${t('Critical')}`}
                </Label>
                <Label
                  className={severityFilter === 'warning' ? activeFilterLabelStyle : filterLabelStyle}
                  icon={
                    <KialiIcon.ExclamationTriangle color={severityFilter === 'warning' ? PFColors.White : undefined} />
                  }
                  isClickable
                  render={({ className, componentRef, content }) => (
                    <button
                      aria-pressed={severityFilter === 'warning'}
                      className={className}
                      data-test="ai-troubleshooting-filter-warning"
                      onClick={() => toggleSeverityFilter('warning')}
                      ref={componentRef}
                      type="button"
                    >
                      {content}
                    </button>
                  )}
                  status="warning"
                  variant={severityFilter === 'warning' ? 'filled' : 'outline'}
                >
                  {`${visibleSummary.warning} ${t('Warning')}`}
                </Label>
                {hiddenSubproblemCount > 0 && (
                  <Label
                    className={hiddenExpanded ? activeFilterLabelStyle : filterLabelStyle}
                    color="grey"
                    icon={<EyeSlashIcon />}
                    isClickable
                    render={({ className, componentRef, content }) => (
                      <button
                        aria-expanded={hiddenExpanded}
                        className={className}
                        data-test="ai-troubleshooting-toggle-ignored"
                        onClick={() => setHiddenExpanded(prev => !prev)}
                        ref={componentRef}
                        type="button"
                      >
                        {content}
                      </button>
                    )}
                    variant={hiddenExpanded ? 'filled' : 'outline'}
                  >
                    {hiddenExpanded
                      ? t('Hide ignored ({{count}})', { count: hiddenSubproblemCount })
                      : t('Show ignored ({{count}})', { count: hiddenSubproblemCount })}
                  </Label>
                )}
              </div>
            </ToolbarItem>
            <ToolbarItem>
              <SearchInput
                aria-label={t('Filter troubleshooting issues')}
                data-test="ai-troubleshooting-search"
                onChange={(_event, value) => setSearch(value)}
                onClear={() => setSearch('')}
                placeholder={t('Filter by namespace, resource, or code...')}
                value={search}
              />
            </ToolbarItem>
            <ToolbarItem>
              <span className={groupByLabelStyle}>{t('Group by:')}</span>
              <ToolbarDropdown
                handleSelect={value => setGroupBy(value as TroubleshootingGroupBy)}
                id="ai-troubleshooting-group-by"
                label={groupOptions[groupBy]}
                options={groupOptions}
                tooltip={t('Group troubleshooting issues by')}
                value={groupBy}
              />
            </ToolbarItem>
          </>
        )}
        <ToolbarGroup align={{ default: 'alignEnd' }}>
          <ToolbarItem>
            <Refresh id="ai-troubleshooting-refresh" disabled={false} manageURL={true} />
          </ToolbarItem>
        </ToolbarGroup>
      </ToolbarContent>
    </Toolbar>
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
        {displayedVisibleIssues.map(issue => (
          <TroubleshootingIssueCard issue={issue} key={`visible-${issue.id}`} />
        ))}
        {hiddenSubproblemCount > 0 && (
          <ExpandableSection
            className={hiddenSectionStyle}
            data-test="ai-troubleshooting-hidden"
            isExpanded={hiddenExpanded}
            onToggle={(_event, expanded) => setHiddenExpanded(expanded)}
            toggleId="ai-troubleshooting-hidden-toggle"
            toggleText={hiddenProblemsTitle(hiddenSummary)}
            toggleWrapper="h2"
          >
            <div className={hiddenIssuesStyle}>
              {hidden.map(issue => (
                <TroubleshootingIssueCard hidden issue={issue} key={`hidden-${issue.id}`} />
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
