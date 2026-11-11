import * as React from 'react';
import { useRef, useState } from 'react';
import {
  Divider,
  Dropdown,
  DropdownItem,
  DropdownList,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  ExpandableSection,
  ExpandableSectionToggle,
  MenuToggle,
  NotificationDrawer,
  NotificationDrawerBody,
  NotificationDrawerGroup,
  NotificationDrawerGroupList,
  NotificationDrawerHeader,
  NotificationDrawerList,
  NotificationDrawerListItem,
  NotificationDrawerListItemBody,
  NotificationDrawerListItemHeader,
  Tooltip
} from '@patternfly/react-core';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InfoCircleIcon,
  RhUiAiExperienceIcon
} from '@patternfly/react-icons';
import type { SVGIconProps } from '@patternfly/react-icons/dist/js/createIcon';
import { useKialiTranslation } from 'utils/I18nUtils';
import EllipsisVIcon from '@patternfly/react-icons/dist/esm/icons/ellipsis-v-icon';
import SearchIcon from '@patternfly/react-icons/dist/esm/icons/search-icon';
import TrashIcon from '@patternfly/react-icons/dist/esm/icons/trash-icon';
import { connect } from 'react-redux';
import type { KialiAppState } from 'store/Store';
import type { NotificationGroup, NotificationMessage } from 'types/NotificationCenter';
import type { KialiDispatch } from 'types/Redux';
import { NotificationCenterActions } from 'actions/NotificationCenterActions';
import { NotificationCenterThunkActions } from 'actions/NotificationCenterThunkActions';
import { Paths } from 'config';
import { KialiLink } from 'components/Link/KialiLink';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { PFFontSize } from 'styles/PfTypography';
import moment from 'moment';
import { partitionTroubleshootingIssues } from 'pages/AIDashboard/AITroubleshooting/partitionTroubleshooting';
import type { TroubleshootingIssue } from 'types/Chatbot';

const troubleshootingSectionStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  fontSize: 'var(--pf-t--global--font--size--heading--sm)',
  fontWeight: 'var(--pf-t--global--font--weight--heading--default)',
  paddingBlock: PFSpacer.md,
  paddingInline: PFSpacer.lg
});

const troubleshootingTitleStyle = kialiStyle({
  alignItems: 'center',
  display: 'inline-flex',
  gap: PFSpacer.sm
});

const troubleshootingLinkWrapperStyle = kialiStyle({
  fontSize: PFFontSize.small,
  marginLeft: PFSpacer.md
});

type ReduxStateProps = {
  aiEnabled: boolean;
  groups: NotificationGroup[];
  troubleshootingIssues: TroubleshootingIssue[];
  troubleshootingLoaded: boolean;
};

type ReduxDispatchProps = {
  clearGroup: (group) => void;
  clearMessage: (message) => void;
  markAsRead: (message) => void;
  markGroupAsRead: (group) => void;
  toggleMessageDetail: (message) => void;
  toggleNotificationCenter: () => void;
};

type NotificationCenterProps = ReduxStateProps & ReduxDispatchProps;

const NotificationCenterComponent: React.FC<NotificationCenterProps> = (props: NotificationCenterProps) => {
  const { t } = useKialiTranslation();
  const drawerRef = useRef<HTMLElement | null>(null);

  const getUnseenGroups = (groups: NotificationGroup[]): Set<string> => {
    const unseenGroups = new Set<string>();
    groups.forEach(g => {
      if (g.messages.some(m => !m.seen)) {
        unseenGroups.add(g.id);
      }
    });
    return unseenGroups;
  };

  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(() => getUnseenGroups(props.groups));

  interface ActionsMenu {
    [toggleId: string]: boolean;
  }

  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState<ActionsMenu>({});

  const onToggle = (id: string): void => {
    setIsActionsMenuOpen({ [id]: !isActionsMenuOpen[id] });
  };

  const closeActionsMenu = (): void => setIsActionsMenuOpen({});

  const clearAll = (): void => {
    props.groups.forEach(g => {
      props.clearGroup(g);
    });
    setExpandedGroupIds(new Set());
  };

  const markAllRead = (): void => {
    props.groups.forEach(g => {
      props.markGroupAsRead(g);
    });
  };

  const markRead = (message: NotificationMessage): void => {
    props.markAsRead(message);
  };

  const getNumberUnread = (group?: NotificationGroup): number => {
    if (!group) {
      let numUnread = 0;
      props.groups.forEach(g => {
        numUnread += g.messages.filter(m => !m.seen).length;
      });
      return numUnread;
    }

    return group.messages.filter(m => !m.seen).length;
  };

  const toggleGroupExpanded = (groupId: string, isExpanded): void => {
    setExpandedGroupIds(prev => {
      const newSet = new Set(prev);
      if (isExpanded) {
        newSet.add(groupId);
      } else {
        newSet.delete(groupId);
      }
      return newSet;
    });
  };

  const notificationDrawerActions = (
    <>
      <DropdownItem key="markAllRead" onClick={() => markAllRead()}>
        {t('Mark all read')}
      </DropdownItem>
      <DropdownItem key="clearAll" onClick={() => clearAll()}>
        {t('Clear all')}
      </DropdownItem>
    </>
  );

  const getGroupTitle = (group: NotificationGroup): React.ReactNode => {
    let StatusIcon: React.ComponentClass<SVGIconProps>;
    let iconColor: string;
    switch (group.variant) {
      case 'danger':
        StatusIcon = ExclamationCircleIcon;
        iconColor = PFColors.Danger;
        break;
      case 'warning':
        StatusIcon = ExclamationTriangleIcon;
        iconColor = PFColors.Warning;
        break;
      case 'success':
        StatusIcon = CheckCircleIcon;
        iconColor = PFColors.Success;
        break;
      default:
        StatusIcon = InfoCircleIcon;
        iconColor = PFColors.Info;
    }
    return (
      <span>
        <StatusIcon style={{ color: iconColor, marginRight: '0.5em' }} />
        {t(group.title)}
      </span>
    );
  };

  const formatTimestamp = (date: Date): string => {
    const now = moment();
    const created = moment(date);
    const diffMinutes = now.diff(created, 'minutes');

    if (diffMinutes < 60) {
      return created.fromNow();
    }
    return date.toLocaleString();
  };

  const formatDetail = (message: NotificationMessage): React.ReactNode => {
    if (!message.detail) {
      return '';
    }

    const detail = message.detail;
    if (detail.length > 150 || detail.split('\n').length > 3) {
      const toggleId = `toggle-${message.id}`;
      const contentId = `content-${message.id}`;
      return (
        <>
          <ExpandableSectionToggle
            style={{ marginLeft: '-0.75em', paddingLeft: 0 }}
            isExpanded={message.showDetail}
            onToggle={() => props.toggleMessageDetail(message)}
            toggleId={toggleId}
            contentId={contentId}
            direction="down"
          >
            {message.showDetail ? t('Hide Detail') : t('Show Detail')}
          </ExpandableSectionToggle>
          <ExpandableSection
            isExpanded={message.showDetail}
            isDetached
            direction="up"
            toggleId={toggleId}
            contentId={contentId}
          >
            <span style={{ whiteSpace: 'pre-wrap' }}>{detail}</span>
          </ExpandableSection>
        </>
      );
    }

    return <span style={{ whiteSpace: 'pre-wrap' }}>{message.detail}</span>;
  };

  return (
    <NotificationDrawer ref={drawerRef}>
      <NotificationDrawerHeader
        closeButtonAriaLabel={t('Close')}
        count={getNumberUnread() + props.troubleshootingIssues.length}
        onClose={() => props.toggleNotificationCenter()}
        title={t('Notifications')}
        unreadText={t('unread')}
      >
        <Dropdown
          onSelect={closeActionsMenu}
          isOpen={isActionsMenuOpen['nc-actions'] || false}
          id="nc-actions"
          onOpenChange={(isOpen: boolean) => !isOpen && closeActionsMenu()}
          popperProps={{ position: 'right' }}
          toggle={(toggleRef: React.RefObject<any>) => (
            <MenuToggle
              ref={toggleRef}
              id="nc-actions-toggle"
              aria-label={t('Notification drawer actions')}
              variant="plain"
              onClick={() => onToggle('nc-actions')}
              isExpanded={isActionsMenuOpen['nc-actions'] || false}
              icon={<EllipsisVIcon />}
            />
          )}
        >
          <DropdownList>{notificationDrawerActions} </DropdownList>
        </Dropdown>
      </NotificationDrawerHeader>
      <NotificationDrawerBody>
        <NotificationDrawerGroupList>
          {props.groups.map(group => (
            <NotificationDrawerGroup
              key={group.id}
              title={getGroupTitle(group)}
              isExpanded={expandedGroupIds.has(group.id)}
              count={getNumberUnread(group)}
              onExpand={(_, isExpanded) => toggleGroupExpanded(group.id, isExpanded)}
            >
              <NotificationDrawerList isHidden={!expandedGroupIds.has(group.id)}>
                {group.messages.length === 0 ? (
                  <EmptyState
                    headingLevel="h2"
                    titleText={t('No notifications found')}
                    icon={SearchIcon}
                    variant={EmptyStateVariant.full}
                  >
                    <EmptyStateBody>{t('There are currently no notifications in this group.')}</EmptyStateBody>
                  </EmptyState>
                ) : (
                  group.messages.map(message => (
                    <NotificationDrawerListItem
                      key={message.id}
                      variant={message.type}
                      onClick={() => markRead(message)}
                      isRead={!message.seen}
                    >
                      <NotificationDrawerListItemHeader title={message.content} variant={message.type}>
                        <Tooltip key="clear_message" content={t('Clear')}>
                          <TrashIcon
                            style={{ cursor: 'pointer', marginLeft: '0.5em', marginTop: '0.75em' }}
                            onClick={e => {
                              e.stopPropagation();
                              props.clearMessage(message);
                            }}
                            aria-label={t('Clear message')}
                          />
                        </Tooltip>
                      </NotificationDrawerListItemHeader>
                      <NotificationDrawerListItemBody>
                        <div style={{ marginLeft: '1.6em', paddingLeft: 0 }}>
                          {formatDetail(message)}
                          <div
                            className="pf-v6-c-notification-drawer__list-item-timestamp"
                            style={{
                              marginTop: '1em',
                              marginBottom: 0,
                              display: 'flex',
                              justifyContent: 'space-between'
                            }}
                          >
                            <span>{formatTimestamp(message.created)}</span>
                            {message.count > 1 && (
                              <span>
                                {message.count} {moment().from(message.firstTriggered)}
                              </span>
                            )}
                          </div>
                        </div>
                      </NotificationDrawerListItemBody>
                    </NotificationDrawerListItem>
                  ))
                )}
              </NotificationDrawerList>
            </NotificationDrawerGroup>
          ))}
        </NotificationDrawerGroupList>
        {props.aiEnabled && (
          <>
            <Divider />
            <div className={troubleshootingSectionStyle} data-test="troubleshooting-notification-section">
              <span className={troubleshootingTitleStyle}>
                <RhUiAiExperienceIcon />
                {t('Troubleshooting')}
              </span>
              <span className={troubleshootingLinkWrapperStyle}>
                <KialiLink
                  dataTest="troubleshooting-notification-link"
                  onClick={() => props.toggleNotificationCenter()}
                  to={`/${Paths.AI}?tab=troubleshooting`}
                >
                  {`(${
                    !props.troubleshootingLoaded
                      ? t('Scanning...')
                      : props.troubleshootingIssues.length === 0
                        ? t('No problems detected')
                        : props.troubleshootingIssues.length === 1
                          ? t('1 problem detected')
                          : t('{{count}} problems detected', {
                              count: props.troubleshootingIssues.length
                            })
                  })`}
                </KialiLink>
              </span>
            </div>
          </>
        )}
      </NotificationDrawerBody>
    </NotificationDrawer>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxStateProps => {
  const aiEnabled = !!state.ai?.enabled;
  const troubleshootingLoaded = !!state.ai?.troubleshooting?.loaded;
  return {
    aiEnabled,
    groups: state.notificationCenter.groups,
    troubleshootingIssues:
      aiEnabled && troubleshootingLoaded
        ? partitionTroubleshootingIssues(
            state.ai.troubleshooting.issues ?? [],
            state.ai.troubleshooting.hiddenSubProblemIds ?? []
          ).visible
        : [],
    troubleshootingLoaded
  };
};

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => {
  return {
    clearGroup: group => dispatch(NotificationCenterThunkActions.clearGroup(group.id)),
    clearMessage: message => dispatch(NotificationCenterActions.removeMessage(message.id)),
    markAsRead: message => dispatch(NotificationCenterActions.markAsRead(message.id)),
    markGroupAsRead: group => dispatch(NotificationCenterThunkActions.markGroupAsRead(group.id)),
    toggleNotificationCenter: () => dispatch(NotificationCenterActions.toggleNotificationCenter()),
    toggleMessageDetail: message => dispatch(NotificationCenterActions.toggleMessageDetail(message.id))
  };
};

export const NotificationCenter = connect(mapStateToProps, mapDispatchToProps)(NotificationCenterComponent);
