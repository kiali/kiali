import * as React from 'react';
import { Collapse } from 'react-bootstrap';
import { Expandable } from '@patternfly/react-core';
import { MessageType, NotificationMessage, NotificationGroup } from '../../types/MessageCenter';
import moment from 'moment';
import {
  BoundingClientAwareComponent,
  PropertyType
} from '../BoundingClientAwareComponent/BoundingClientAwareComponent';
import { style } from 'typestyle';

// KIALI-3172 For some reason not fully explained, when loaded with "import" it happens that the NotificationDrawer
// does not come with the expected ".Title", ".Accordion" (etc.) fields.
// Which ends up in React error "Element type is invalid" as those components are undefined.
// Using the "require" way is a workaround.
// Note that it is unclear what triggers the error
// (may happen with or without lazy loading, generally not seen using `yarn start` but seen with build)
const Pf = require('patternfly-react');

const drawerMarginBottom = 20;

const drawerContainerStyle = style({
  overflow: 'auto'
});

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
  <Pf.EmptyState>
    <Pf.EmptyStateIcon name="info" />
    <Pf.EmptyStateTitle> No Messages Available </Pf.EmptyStateTitle>
  </Pf.EmptyState>
);

type NotificationWrapperPropsType = {
  message: NotificationMessage;
  onClick: (message: NotificationMessage) => void;
  onToggleDetail: (message: NotificationMessage) => void;
};

class NotificationWrapper extends React.PureComponent<NotificationWrapperPropsType> {
  toggleDetail = () => {
    this.props.onToggleDetail(this.props.message);
  };

  render() {
    return (
      <Pf.Notification seen={this.props.message.seen} onClick={() => this.props.onClick(this.props.message)}>
        <Pf.Icon className="pull-left" type="pf" name={typeForPfIcon(this.props.message.type)} />
        <Pf.Notification.Content>
          <Pf.Notification.Message>
            {this.props.message.content}
            {this.props.message.detail && (
              <Expandable
                toggleText={this.props.message.showDetail ? 'Hide Detail' : 'Show Detail'}
                onToggle={this.toggleDetail}
                isExpanded={this.props.message.showDetail}
              >
                <pre>{this.props.message.detail}</pre>
              </Expandable>
            )}
            {this.props.message.count > 1 && (
              <div>
                {this.props.message.count} {moment().from(this.props.message.firstTriggered)}
              </div>
            )}
          </Pf.Notification.Message>
          <Pf.Notification.Info
            leftText={this.props.message.created.toLocaleDateString()}
            rightText={this.props.message.created.toLocaleTimeString()}
          />
        </Pf.Notification.Content>
      </Pf.Notification>
    );
  }
}

type NotificationGroupWrapperPropsType = {
  group: NotificationGroup;
  isExpanded: boolean;
  reverseMessageOrder?: boolean;
  onNotificationClick: (message: NotificationMessage) => void;
  onNotificationToggleDetail: (message: NotificationMessage) => void;
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
      <Pf.NotificationDrawer.Panel expanded={isExpanded}>
        <Pf.NotificationDrawer.PanelHeading onClick={() => this.props.onToggle(group)}>
          <Pf.NotificationDrawer.PanelTitle>
            <a className={isExpanded ? '' : 'collapsed'} aria-expanded="true">
              {group.title}
            </a>
          </Pf.NotificationDrawer.PanelTitle>
          <Pf.NotificationDrawer.PanelCounter text={getUnreadMessageLabel(group.messages)} />
        </Pf.NotificationDrawer.PanelHeading>
        <Collapse in={isExpanded}>
          <Pf.NotificationDrawer.PanelCollapse>
            <Pf.NotificationDrawer.PanelBody>
              {group.messages.length === 0 && noNotificationsMessage}
              {this.getMessages().map(message => (
                <NotificationWrapper
                  key={message.id}
                  message={message}
                  onClick={this.props.onNotificationClick}
                  onToggleDetail={this.props.onNotificationToggleDetail}
                />
              ))}
            </Pf.NotificationDrawer.PanelBody>
            {group.showActions && group.messages.length > 0 && (
              <Pf.NotificationDrawer.PanelAction>
                <Pf.NotificationDrawer.PanelActionLink className="drawer-pf-action-link">
                  <Pf.Button bsStyle="link" onClick={() => this.props.onMarkGroupAsRead(group)}>
                    Mark All Read
                  </Pf.Button>
                </Pf.NotificationDrawer.PanelActionLink>
                <Pf.NotificationDrawer.PanelActionLink data-toggle="clear-all">
                  <Pf.Button bsStyle="link" onClick={() => this.props.onClearGroup(group)}>
                    <Pf.Icon type="pf" name="close" />
                    Clear All
                  </Pf.Button>
                </Pf.NotificationDrawer.PanelActionLink>
              </Pf.NotificationDrawer.PanelAction>
            )}
          </Pf.NotificationDrawer.PanelCollapse>
        </Collapse>
      </Pf.NotificationDrawer.Panel>
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
  onNotificationToggleDetail: (message: NotificationMessage, group: NotificationGroup) => void;
};

type StateType = {};

export default class NotificationDrawer extends React.PureComponent<PropsType, StateType> {
  render() {
    return (
      <Pf.NotificationDrawer hide={this.props.isHidden} expanded={this.props.isExpanded}>
        <Pf.NotificationDrawer.Title
          title={this.props.title}
          onExpandClick={this.props.onExpandDrawer}
          onCloseClick={this.props.onHideDrawer}
        />
        <BoundingClientAwareComponent
          className={drawerContainerStyle}
          maxHeight={{ type: PropertyType.VIEWPORT_HEIGHT_MINUS_TOP, margin: drawerMarginBottom }}
        >
          <Pf.NotificationDrawer.Accordion>
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
                  onNotificationToggleDetail={(message: NotificationMessage) =>
                    this.props.onNotificationToggleDetail(message, group)
                  }
                  onMarkGroupAsRead={this.props.onMarkGroupAsRead}
                  onClearGroup={this.props.onClearGroup}
                />
              );
            })}
          </Pf.NotificationDrawer.Accordion>
        </BoundingClientAwareComponent>
      </Pf.NotificationDrawer>
    );
  }
}
