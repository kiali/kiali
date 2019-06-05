import * as React from 'react';
import { Collapse } from 'react-bootstrap';

import {
  NotificationDrawer as PfNotificationDrawer,
  Notification,
  Icon,
  Button,
  EmptyState,
  EmptyStateTitle,
  EmptyStateIcon
} from 'patternfly-react';

import { MessageType, NotificationMessage, NotificationGroup } from '../../types/MessageCenter';
import moment from 'moment';

const typeForPfIcon = (type: MessageType) => {
  switch (type) {
    case MessageType.ERROR:
      return 'error-circle-o';
    case MessageType.INFO:
      return 'info';
    case MessageType.SUCCESS:
      return 'ok';
    case MessageType.WARNING:
      return 'warning-triangle-o';
    default:
      throw Error('Unexpected type');
  }
};

const getUnreadCount = (messages: NotificationMessage[]) => {
  return messages.reduce((count, message) => {
    return message.seen ? count : count + 1;
  }, 0);
};

const getUnreadMessageLabel = (messages: NotificationMessage[]) => {
  const unreadCount = getUnreadCount(messages);
  return unreadCount === 1 ? '1 Unread Message' : `${getUnreadCount(messages)} Unread Messages`;
};

type StatelessType = {};

const noNotificationsMessage = (
  <EmptyState>
    <EmptyStateIcon name="info" />
    <EmptyStateTitle> No Messages Available </EmptyStateTitle>
  </EmptyState>
);

type NotificationWrapperPropsType = {
  message: NotificationMessage;
  onClick: (message: NotificationMessage) => void;
};

class NotificationWrapper extends React.PureComponent<NotificationWrapperPropsType, StatelessType> {
  render() {
    return (
      <Notification seen={this.props.message.seen} onClick={() => this.props.onClick(this.props.message)}>
        <Icon className="pull-left" type="pf" name={typeForPfIcon(this.props.message.type)} />
        <Notification.Content>
          <Notification.Message>
            {this.props.message.content}
            {this.props.message.count > 1 && (
              <div>
                {this.props.message.count} {moment().from(this.props.message.firstTriggered)}
              </div>
            )}
          </Notification.Message>
          <Notification.Info
            leftText={this.props.message.created.toLocaleDateString()}
            rightText={this.props.message.created.toLocaleTimeString()}
          />
        </Notification.Content>
      </Notification>
    );
  }
}

type NotificationGroupWrapperPropsType = {
  group: NotificationGroup;
  isExpanded: boolean;
  reverseMessageOrder?: boolean;
  onNotificationClick: (message: NotificationMessage) => void;
  onMarkGroupAsRead: (group: NotificationGroup) => void;
  onClearGroup: (group: NotificationGroup) => void;
  onToggle: (group: NotificationGroup) => void;
};

class NotificationGroupWrapper extends React.PureComponent<NotificationGroupWrapperPropsType, StatelessType> {
  getMessages = () => {
    return this.props.reverseMessageOrder ? [...this.props.group.messages].reverse() : this.props.group.messages;
  };

  render() {
    const group = this.props.group;
    const isExpanded = this.props.isExpanded;

    if (group.hideIfEmpty && group.messages.length === 0) {
      return null;
    }

    return (
      <PfNotificationDrawer.Panel expanded={isExpanded}>
        <PfNotificationDrawer.PanelHeading onClick={() => this.props.onToggle(group)}>
          <PfNotificationDrawer.PanelTitle>
            <a className={isExpanded ? '' : 'collapsed'} aria-expanded="true">
              {group.title}
            </a>
          </PfNotificationDrawer.PanelTitle>
          <PfNotificationDrawer.PanelCounter text={getUnreadMessageLabel(group.messages)} />
        </PfNotificationDrawer.PanelHeading>
        <Collapse in={isExpanded}>
          <PfNotificationDrawer.PanelCollapse>
            <PfNotificationDrawer.PanelBody>
              {group.messages.length === 0 && noNotificationsMessage}
              {this.getMessages().map(message => (
                <NotificationWrapper key={message.id} message={message} onClick={this.props.onNotificationClick} />
              ))}
            </PfNotificationDrawer.PanelBody>
            {group.showActions && group.messages.length > 0 && (
              <PfNotificationDrawer.PanelAction>
                <PfNotificationDrawer.PanelActionLink className="drawer-pf-action-link">
                  <Button bsStyle="link" onClick={() => this.props.onMarkGroupAsRead(group)}>
                    Mark All Read
                  </Button>
                </PfNotificationDrawer.PanelActionLink>
                <PfNotificationDrawer.PanelActionLink data-toggle="clear-all">
                  <Button bsStyle="link" onClick={() => this.props.onClearGroup(group)}>
                    <Icon type="pf" name="close" />
                    Clear All
                  </Button>
                </PfNotificationDrawer.PanelActionLink>
              </PfNotificationDrawer.PanelAction>
            )}
          </PfNotificationDrawer.PanelCollapse>
        </Collapse>
      </PfNotificationDrawer.Panel>
    );
  }
}

type PropsType = {
  title: string;
  isHidden?: boolean;
  isExpanded?: boolean;
  expandedGroupId?: string;
  groups: NotificationGroup[];
  reverseMessageOrder?: boolean;

  onExpandDrawer?: () => void;
  onHideDrawer?: () => void;
  onToggleGroup: (group: NotificationGroup) => void;
  onMarkGroupAsRead: (group: NotificationGroup) => void;
  onClearGroup: (group: NotificationGroup) => void;
  onNotificationClick: (message: NotificationMessage, group: NotificationGroup) => void;
};

type StateType = {};

export default class NotificationDrawer extends React.PureComponent<PropsType, StateType> {
  render() {
    return (
      <PfNotificationDrawer hide={this.props.isHidden} expanded={this.props.isExpanded}>
        <PfNotificationDrawer.Title
          title={this.props.title}
          onExpandClick={this.props.onExpandDrawer}
          onCloseClick={this.props.onHideDrawer}
        />
        <PfNotificationDrawer.Accordion>
          {this.props.groups.length === 0 && noNotificationsMessage}
          {this.props.groups.map(group => {
            return (
              <NotificationGroupWrapper
                key={group.id}
                group={group}
                reverseMessageOrder={this.props.reverseMessageOrder}
                isExpanded={group.id === this.props.expandedGroupId}
                onToggle={this.props.onToggleGroup}
                onNotificationClick={(message: NotificationMessage) => this.props.onNotificationClick(message, group)}
                onMarkGroupAsRead={this.props.onMarkGroupAsRead}
                onClearGroup={this.props.onClearGroup}
              />
            );
          })}
        </PfNotificationDrawer.Accordion>
      </PfNotificationDrawer>
    );
  }
}
