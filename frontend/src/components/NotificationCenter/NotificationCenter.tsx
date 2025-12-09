import * as React from 'react';
import { useRef, useState } from 'react';
import {
  Dropdown,
  DropdownItem,
  DropdownList,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  MenuToggle,
  NotificationDrawer,
  NotificationDrawerBody,
  NotificationDrawerGroup,
  NotificationDrawerGroupList,
  NotificationDrawerHeader,
  NotificationDrawerList,
  NotificationDrawerListItem,
  NotificationDrawerListItemBody,
  NotificationDrawerListItemHeader
} from '@patternfly/react-core';
import { useKialiTranslation } from 'utils/I18nUtils';
import EllipsisVIcon from '@patternfly/react-icons/dist/esm/icons/ellipsis-v-icon';
import SearchIcon from '@patternfly/react-icons/dist/esm/icons/search-icon';
import { connect } from 'react-redux';
import { KialiAppState } from 'store/Store';
import { NotificationGroup, NotificationMessage } from 'types/NotificationCenter';
import { KialiDispatch } from 'types/Redux';
import { NotificationCenterActions } from 'actions/NotificationCenterActions';
import { NotificationCenterThunkActions } from 'actions/NotificationCenterThunkActions';
import { PFColors } from 'components/Pf/PfColors';
import moment from 'moment';

type ReduxStateProps = {
  groups: NotificationGroup[];
};

type ReduxDispatchProps = {
  markAsRead: (message) => void;
  clearGroup: (group) => void;
  clearMessage: (message) => void;
  markGroupAsRead: (group) => void;
  toggleNotificationCenter: () => void;
  toggleMessageDetail: (message) => void;
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

  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(getUnseenGroups(props.groups));

  interface ActionsMenu {
    [toggleId: string]: boolean;
  }

  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState<ActionsMenu | {}>({});

  const onToggle = (id: string) => {
    setIsActionsMenuOpen({ [id]: !isActionsMenuOpen[id] });
  };

  const closeActionsMenu = () => setIsActionsMenuOpen({});

  const clearAll = () => {
    props.groups.forEach(g => {
      props.clearGroup(g);
    });
    setExpandedGroupIds(new Set());
  };

  const markAllRead = () => {
    props.groups.forEach(g => {
      props.markGroupAsRead(g);
    });
  };

  const markRead = (message: NotificationMessage) => {
    props.markAsRead(message);
  };

  const getNumberUnread = (group?: NotificationGroup) => {
    if (!group) {
      let numUnread = 0;
      props.groups.forEach(g => {
        numUnread += g.messages.filter(m => !m.seen).length;
      });
      return numUnread;
    }

    return group.messages.filter(m => !m.seen).length;
  };

  const toggleGroupExpanded = (groupId: string) => (_event: React.MouseEvent, isExpanded: boolean) => {
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

  const notificationDrawerDropdownItems = (message: NotificationMessage) => (
    <>
      <DropdownItem key="messageClear" onClick={() => props.clearMessage(message)}>
        {t('Clear')}
      </DropdownItem>
      {message.detail && message.showDetail && (
        <DropdownItem key="messageDetail" onClick={() => props.toggleMessageDetail(message)}>
          {t('Hide Detail')}
        </DropdownItem>
      )}
      {message.detail && !message.showDetail && (
        <DropdownItem key="messageDetail" onClick={() => props.toggleMessageDetail(message)}>
          {t('Show Detail')}
        </DropdownItem>
      )}
    </>
  );

  const getGroupTitle = (group: NotificationGroup): React.ReactNode => {
    switch (group.variant) {
      case 'danger':
        return <span style={{ color: PFColors.Danger }}>{t(group.title)}</span>;
      case 'warning':
        return <span style={{ color: PFColors.Warning }}>{t(group.title)}</span>;
      case 'success':
        return <span style={{ color: PFColors.Success }}>{t(group.title)}</span>;
      default:
        return <span style={{ color: PFColors.Info }}>{t(group.title)}</span>;
    }
  };

  return (
    <NotificationDrawer ref={drawerRef}>
      <NotificationDrawerHeader count={getNumberUnread()} onClose={() => props.toggleNotificationCenter()}>
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
              onExpand={toggleGroupExpanded(group.id)}
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
                        <Dropdown
                          onSelect={closeActionsMenu}
                          isOpen={isActionsMenuOpen[`toggle-${message.id}`] || false}
                          id={`notification-${message.id}`}
                          onOpenChange={(isOpen: boolean) => !isOpen && closeActionsMenu()}
                          popperProps={{ position: 'right' }}
                          toggle={(toggleRef: React.RefObject<any>) => (
                            <MenuToggle
                              ref={toggleRef}
                              id={`toggle-${message.id}`}
                              aria-label={t('Notification drawer actions')}
                              variant="plain"
                              onClick={() => onToggle(`toggle-${message.id}`)}
                              isExpanded={isActionsMenuOpen[`toggle-${message.id}`] || false}
                              icon={<EllipsisVIcon />}
                            />
                          )}
                        >
                          <DropdownList>{notificationDrawerDropdownItems(message)}</DropdownList>
                        </Dropdown>
                      </NotificationDrawerListItemHeader>
                      <NotificationDrawerListItemBody timestamp={message.created.toLocaleString()}>
                        {message.showDetail && message.detail}
                        {message.count > 1 && (
                          <div>
                            {message.count} {moment().from(message.firstTriggered)}
                          </div>
                        )}
                      </NotificationDrawerListItemBody>
                    </NotificationDrawerListItem>
                  ))
                )}
              </NotificationDrawerList>
            </NotificationDrawerGroup>
          ))}
        </NotificationDrawerGroupList>
      </NotificationDrawerBody>
    </NotificationDrawer>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxStateProps => {
  return {
    groups: state.notificationCenter.groups
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
