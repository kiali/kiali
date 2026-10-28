import {
  Divider,
  Drawer,
  DrawerContent,
  DrawerContentBody,
  DrawerPanelContent,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  ExpandableSection,
  NotificationDrawer,
  NotificationDrawerBody,
  NotificationDrawerGroup,
  NotificationDrawerGroupList,
  NotificationDrawerHeader,
  NotificationDrawerList,
  NotificationDrawerListItem,
  NotificationDrawerListItemHeader,
  Tooltip
} from '@patternfly/react-core';
import SearchIcon from '@patternfly/react-icons/dist/esm/icons/search-icon';
import * as React from 'react';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom-v5-compat';

import { Paths } from 'config';
import { KialiLink } from 'components/Link/KialiLink';
import { TroubleshootingAnalysis } from 'components/TroubleshootingAnalyze/TroubleshootingAnalysis';
import { useTroubleshootingDrawer } from 'hooks/useTroubleshootingDrawer';
import { TroubleshootingProblemInfo } from 'pages/AIDashboard/AITroubleshooting/TroubleshootingProblemInfo';
import { summarizeTroubleshootingIssues } from 'pages/AIDashboard/AITroubleshooting/partitionTroubleshooting';
import type { KialiAppState } from 'store/Store';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { PFFontSize, PFFontWeight } from 'styles/PfTypography';
import type { TroubleshootingConversation } from 'types/Chatbot';
import { t } from 'utils/I18nUtils';

const drawerStyle = kialiStyle({
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  $nest: {
    '& .pf-v6-c-drawer__content': {
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      minWidth: 0
    },
    '& .pf-v6-c-drawer__main': {
      minHeight: 0
    }
  }
});

const contentBodyStyle = kialiStyle({
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  minHeight: 0,
  minWidth: 0
});

const panelStyle = kialiStyle({
  height: '100%',
  minHeight: 0,
  $nest: {
    '& .pf-v6-c-drawer__panel-main': {
      display: 'flex',
      flex: '1 1 auto',
      flexDirection: 'column',
      minHeight: 0,
      overflow: 'hidden'
    }
  }
});

const notificationStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  overflow: 'hidden',
  $nest: {
    '& > .pf-v6-c-notification-drawer__body': {
      overflow: 'hidden'
    }
  }
});

const bodyStyle = kialiStyle({
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  minHeight: 0,
  overflow: 'hidden'
});

const historyListStyle = kialiStyle({
  maxHeight: '12rem',
  overflow: 'auto'
});

const historyEmptyStyle = kialiStyle({
  paddingBlock: PFSpacer.sm,
  paddingInline: PFSpacer.md,
  $nest: {
    '& .pf-v6-c-empty-state__icon': {
      fontSize: 'var(--pf-t--global--icon--size--md)',
      marginBlockEnd: PFSpacer.xs
    },
    '& .pf-v6-c-empty-state__title-text': {
      fontSize: PFFontSize.default
    },
    '& .pf-v6-c-empty-state__body': {
      fontSize: PFFontSize.small,
      marginBlockStart: PFSpacer.xs
    }
  }
});

const analysisStyle = kialiStyle({
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  gap: PFSpacer.md,
  minHeight: 0,
  overflow: 'hidden',
  padding: PFSpacer.md
});

const problemSectionStyle = kialiStyle({
  flexShrink: 0,
  minWidth: 0,
  $nest: {
    '& .pf-v6-c-expandable-section__toggle': {
      maxWidth: '100%'
    },
    '& .pf-v6-c-expandable-section__toggle .pf-v6-c-button': {
      maxWidth: '100%',
      minWidth: 0
    },
    '& .pf-v6-c-button__text': {
      display: 'block',
      maxWidth: '100%',
      minWidth: 0
    },
    '&.pf-m-expanded .pf-v6-c-expandable-section__content': {
      maxHeight: '8rem',
      overflow: 'auto'
    }
  }
});

const topicToggleStyle = kialiStyle({
  alignItems: 'baseline',
  display: 'flex',
  gap: PFSpacer.sm,
  maxWidth: '100%',
  minWidth: 0
});

const topicStyle = kialiStyle({
  flex: '1 1 auto',
  fontWeight: PFFontWeight.HeadingDefault,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
});

const showMoreStyle = kialiStyle({
  flexShrink: 0
});

const titleStyle = kialiStyle({
  fontWeight: PFFontWeight.HeadingDefault,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
});

const separatorStyle = kialiStyle({
  marginBottom: 0,
  marginTop: 0
});

const threadStyle = kialiStyle({
  flex: 1,
  minHeight: 0,
  overflow: 'auto'
});

const headerLinkStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  marginRight: PFSpacer.sm
});

const detectedProblemsLabel = (problems: number): string => {
  const detected = problems === 1 ? t('1 problem detected') : t('{{count}} problems detected', { count: problems });
  return `(${detected})`;
};

const historyVariant = (conversation: TroubleshootingConversation): 'danger' | 'info' | 'warning' => {
  const severity = conversation.subProblem?.severity;
  if (severity === 'critical') {
    return 'danger';
  }
  if (severity === 'warning') {
    return 'warning';
  }
  return 'info';
};

const showProblemInfo = (conversation: TroubleshootingConversation): boolean => {
  const subProblem = conversation.subProblem;
  return Boolean(subProblem && (subProblem.impact || (subProblem.checks ?? []).length > 0));
};

const showProblemSection = (conversation: TroubleshootingConversation): boolean =>
  Boolean(conversation.description) || showProblemInfo(conversation);

const TroubleshootingDrawerPanel: React.FC = () => {
  const { pathname } = useLocation();
  const { activeConversation, close, conversations, select } = useTroubleshootingDrawer();
  const issues = useSelector((state: KialiAppState) => state.ai.troubleshooting.issues ?? []);
  const problems = summarizeTroubleshootingIssues(issues).problems;
  const activeConversationId = activeConversation?.id;
  // Collapse history and problem details when a different conversation opens.
  const [seenConversationId, setSeenConversationId] = React.useState(activeConversationId);
  const [historyExpanded, setHistoryExpanded] = React.useState(false);
  const [problemExpanded, setProblemExpanded] = React.useState(false);

  if (seenConversationId !== activeConversationId) {
    setSeenConversationId(activeConversationId);
    setHistoryExpanded(false);
    setProblemExpanded(false);
  }

  return (
    <NotificationDrawer className={notificationStyle} data-test="ai-troubleshooting-drawer-body">
      <NotificationDrawerHeader
        closeButtonAriaLabel={t('Close')}
        customText={detectedProblemsLabel(problems)}
        data-test="troubleshooting-drawer-header"
        onClose={close}
        title={t('Troubleshooting')}
      >
        {!pathname.endsWith(`/${Paths.AI}`) && (
          <div className={headerLinkStyle}>
            <KialiLink dataTest="troubleshooting-drawer-link" to={`/${Paths.AI}?tab=troubleshooting`}>
              {t('Troubleshooting page')}
            </KialiLink>
          </div>
        )}
      </NotificationDrawerHeader>
      <NotificationDrawerBody className={bodyStyle}>
        <NotificationDrawerGroupList>
          <NotificationDrawerGroup
            count={conversations.length}
            isExpanded={historyExpanded}
            onExpand={(_event, expanded) => setHistoryExpanded(expanded)}
            title={t('History')}
          >
            <NotificationDrawerList
              aria-label={t('Troubleshooting history')}
              className={conversations.length === 0 ? undefined : historyListStyle}
              data-test="troubleshooting-history-list"
              isHidden={!historyExpanded}
            >
              {conversations.length === 0 ? (
                <EmptyState
                  className={historyEmptyStyle}
                  headingLevel="h2"
                  icon={SearchIcon}
                  titleText={t('No troubleshooting history')}
                  variant={EmptyStateVariant.xs}
                >
                  <EmptyStateBody>{t('Analyze a problem to start a troubleshooting conversation.')}</EmptyStateBody>
                </EmptyState>
              ) : (
                conversations.map(conversation => (
                  <NotificationDrawerListItem
                    data-test="troubleshooting-history-item"
                    isHoverable
                    isRead={conversation.id !== activeConversation?.id}
                    key={conversation.id}
                    onClick={() => {
                      select(conversation.id);
                      setHistoryExpanded(false);
                    }}
                    tabIndex={0}
                    variant={historyVariant(conversation)}
                  >
                    <NotificationDrawerListItemHeader
                      title={conversation.problem}
                      truncateTitle={1}
                      variant={historyVariant(conversation)}
                    />
                  </NotificationDrawerListItem>
                ))
              )}
            </NotificationDrawerList>
          </NotificationDrawerGroup>
        </NotificationDrawerGroupList>
        {activeConversation && (
          <TroubleshootingAnalysis conversationId={activeConversation.id} key={activeConversation.id}>
            {({ composer, thread }) => (
              <div className={analysisStyle}>
                {showProblemSection(activeConversation) ? (
                  <>
                    <ExpandableSection
                      className={problemSectionStyle}
                      data-test="ai-troubleshooting-problem-details"
                      hasToggleIcon={false}
                      isExpanded={problemExpanded}
                      onToggle={(_event, expanded) => setProblemExpanded(expanded)}
                      toggleContent={
                        <span className={topicToggleStyle}>
                          <Tooltip content={activeConversation.problem}>
                            <span className={topicStyle} data-test="ai-troubleshooting-analysis-title">
                              {activeConversation.problem}
                            </span>
                          </Tooltip>
                          <span className={showMoreStyle}>{problemExpanded ? t('Show less') : t('Show more')}</span>
                        </span>
                      }
                    >
                      {activeConversation.description && <div>{activeConversation.description}</div>}
                      {showProblemInfo(activeConversation) && activeConversation.subProblem && (
                        <TroubleshootingProblemInfo subProblem={activeConversation.subProblem} />
                      )}
                    </ExpandableSection>
                    <Divider className={separatorStyle} data-test="ai-troubleshooting-analysis-separator" />
                  </>
                ) : (
                  <Tooltip content={activeConversation.problem}>
                    <div className={titleStyle} data-test="ai-troubleshooting-analysis-title">
                      {activeConversation.problem}
                    </div>
                  </Tooltip>
                )}
                <div className={threadStyle}>{thread}</div>
                {composer}
              </div>
            )}
          </TroubleshootingAnalysis>
        )}
      </NotificationDrawerBody>
    </NotificationDrawer>
  );
};

type TroubleshootingDrawerProps = {
  children?: React.ReactNode;
};

export const TroubleshootingDrawer: React.FC<TroubleshootingDrawerProps> = ({ children }) => {
  const { expanded } = useTroubleshootingDrawer();

  return (
    <Drawer className={drawerStyle} isExpanded={expanded} isInline position="end">
      <DrawerContent
        panelContent={
          <DrawerPanelContent
            className={panelStyle}
            data-test="ai-troubleshooting-drawer"
            defaultSize="36rem"
            id="ai-troubleshooting-drawer"
            isResizable
            maxSize="70%"
            minSize="22rem"
            resizeAriaLabel={t('Resize troubleshooting drawer')}
          >
            {expanded && <TroubleshootingDrawerPanel />}
          </DrawerPanelContent>
        }
      >
        <DrawerContentBody className={contentBodyStyle}>{children}</DrawerContentBody>
      </DrawerContent>
    </Drawer>
  );
};
