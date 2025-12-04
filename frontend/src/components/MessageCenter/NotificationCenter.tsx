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
import { NotificationGroup, NotificationMessage } from 'types/MessageCenter';
import { KialiDispatch } from 'types/Redux';
import { MessageCenterActions } from 'actions/MessageCenterActions';
import { MessageCenterThunkActions } from 'actions/MessageCenterThunkActions';
import { PFColors } from 'components/Pf/PfColors';

type ReduxStateProps = {
  groups: NotificationGroup[];
};

type ReduxDispatchProps = {
  markAsRead: (NotificationMessage) => void;
  clearGroup: (group) => void;
  markGroupAsRead: (group) => void;
  onDismissNotification: (NotificationMessage, boolean) => void;
  toggleMessageCenter: () => void;
  toggleMessageDetail: (NotificationMessage) => void;
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
    /*
            if (!message.seen) {
                message.seen = true;
                setNumberUnread(numberUnread - 1)
            }
            props.groups.forEach(g => {
                g.messages.forEach(m => m.seen = true);
            })
            */
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

  const toggleGroupExpanded = (groupId: string) => (_event: any, isExpanded: boolean) => {
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

  /*
      const focusDrawer = (_event: any) => {
          if (drawerRef.current === null) {
              return;
          }
          // Prevent the NotificationDrawer from receiving focus if a drawer group item is opened
          if (!document.activeElement?.closest(`.${drawerRef.current.className}`)) {
              const firstTabbableItem = drawerRef.current.querySelector('a, button') as
                  | HTMLAnchorElement
                  | HTMLButtonElement
                  | null;
              firstTabbableItem?.focus();
          }
      };
      */

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

  const notificationDrawerDropdownItems = (
    <>
      <DropdownItem key="detail">Show Detail</DropdownItem>
    </>
  );

  const getGroupTitle = (group: NotificationGroup): React.ReactNode => {
    switch (group.variant) {
      case 'danger':
        return <span style={{ color: PFColors.Danger }}>{group.title}</span>;
      case 'warning':
        return <span style={{ color: PFColors.Warning }}>{group.title}</span>;
      default:
        return <span style={{ color: PFColors.Info }}>{group.title}</span>;
    }
  };

  return (
    <NotificationDrawer ref={drawerRef}>
      <NotificationDrawerHeader count={getNumberUnread()} onClose={() => props.toggleMessageCenter()}>
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
              aria-label="Notification drawer actions"
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
                      <NotificationDrawerListItemHeader
                        variant={message.type}
                        title={message.content}
                        srTitle={`${message.type} notification:`}
                      >
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
                          <DropdownList>{notificationDrawerDropdownItems}</DropdownList>
                        </Dropdown>
                      </NotificationDrawerListItemHeader>
                      <NotificationDrawerListItemBody timestamp={message.created.toLocaleString()}>
                        {message.detail}
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
    groups: state.messageCenter.groups
  };
};

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => {
  return {
    clearGroup: group => dispatch(MessageCenterThunkActions.clearGroup(group.id)),
    markAsRead: message => dispatch(MessageCenterActions.markAsRead(message.id)),
    markGroupAsRead: group => dispatch(MessageCenterThunkActions.markGroupAsRead(group.id)),
    onDismissNotification: (message, userDismissed) => {
      if (userDismissed) {
        dispatch(MessageCenterActions.markAsRead(message.id));
      } else {
        dispatch(MessageCenterActions.hideNotification(message.id));
      }
    },
    toggleMessageCenter: () => dispatch(MessageCenterThunkActions.toggleMessageCenter()),
    toggleMessageDetail: message => dispatch(MessageCenterActions.toggleMessageDetail(message.id))
  };
};

export const NotificationCenter = connect(mapStateToProps, mapDispatchToProps)(NotificationCenterComponent);
