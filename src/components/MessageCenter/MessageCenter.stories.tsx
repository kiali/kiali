import '../../app/App.css';

import * as React from 'react';
import { action } from '@storybook/addon-actions';

import { Button, ButtonGroup } from 'patternfly-react';
import { storiesOf } from '@storybook/react';

import StatefulMessageCenter from './StatefulMessageCenter';
import { MessageType } from './Types';
import { Icon } from 'patternfly-react';
import PfContainerNavVertical from '../Pf/PfContainerNavVertical';

const groups = [
  {
    id: 'default',
    title: 'Group title',
    messages: [
      {
        id: 1,
        seen: false,
        type: MessageType.ERROR,
        content: 'This is an error'
      },
      {
        id: 2,
        seen: true,
        type: MessageType.INFO,
        content: 'This is an info message'
      },
      {
        id: 3,
        seen: true,
        type: MessageType.WARNING,
        content: 'This is a warning'
      },
      {
        id: 4,
        seen: false,
        type: MessageType.SUCCESS,
        content: 'This is OK'
      }
    ]
  },
  {
    id: 'group-2',
    title: 'Other group',
    messages: [
      {
        id: 5,
        seen: true,
        type: MessageType.ERROR,
        content: 'other group This is an error'
      },
      {
        id: 6,
        seen: true,
        type: MessageType.INFO,
        content: 'This is an info message other group '
      },
      {
        id: 7,
        seen: true,
        type: MessageType.WARNING,
        content: 'This is a warning other group '
      },
      {
        id: 8,
        seen: false,
        type: MessageType.SUCCESS,
        content: 'This is OK other group '
      }
    ]
  },
  {
    id: 'group-3',
    title: 'Empty group',
    messages: []
  }
];

class StorybookStatefulMessageCenter extends React.Component<any, any> {
  messageCenter: StatefulMessageCenter;
  lastId: number;

  constructor(props: any) {
    super(props);
    this.lastId = groups
      .reduce((messages: any[], group) => messages.concat(group.messages), [])
      .reduce((maxId, message) => (maxId > message.id ? maxId : message.id), -1);
    this.state = {
      groups: groups
    };
  }

  addMessage = (groupId, message, type) => {
    this.setState(prevState => {
      const groups = prevState.groups.map(group => {
        if (group.id == groupId) {
          return {
            ...group,
            messages: group.messages.concat([
              {
                id: this.lastId++,
                seen: false,
                content: message,
                type,
                show_notification: true
              }
            ])
          };
        }
        return group;
      });
      return { groups: groups };
    });
  };

  onDismissNotification = (message, group) => {
    const groupId = group.id;
    const messageId = message.id;
    this.setState(prevState => {
      const groups = prevState.groups.map(group => {
        if (group.id == groupId) {
          return {
            ...group,
            messages: group.messages.map(message => {
              if (message.id == messageId) {
                return {
                  ...message,
                  show_notification: false
                };
              }
              return message;
            })
          };
        }
        return group;
      });
      return {
        groups
      };
    });
  };

  onClearGroup = group => {
    const groupId = group.id;
    this.setState(prevState => {
      return {
        groups: prevState.groups.map(group => {
          if (group.id == groupId) {
            return {
              ...group,
              messages: []
            };
          }
          return group;
        })
      };
    });
  };

  onMarkGroupAsRead = group => {
    const groupId = group.id;
    this.setState(prevState => {
      return {
        groups: prevState.groups.map(group => {
          if (group.id == groupId) {
            return {
              ...group,
              messages: group.messages.map(message => ({
                ...message,
                seen: true
              }))
            };
          }
          return group;
        })
      };
    });
  };

  render() {
    return (
      <>
        <div className="pull-right">
          Click to show the message center ->
          <a className="nav-item-iconic" onClick={() => this.messageCenter.toggleDrawer()}>
            <Icon name="bell" size="lg" style={{ marginRight: '50px', marginTop: '10px' }} />
          </a>
          <div className="clearfix" />
          <StatefulMessageCenter
            ref={(mc: StatefulMessageCenter) => (this.messageCenter = mc)}
            drawerTitle={'Message Center'}
            drawerIsHidden={true}
            drawerIsExpanded={false}
            drawerExpandedGroupId={'default'}
            drawerReverseMessageOrder={true}
            groups={this.state.groups}
            onMarkGroupAsRead={this.onMarkGroupAsRead}
            onClearGroup={this.onClearGroup}
            onNotificationClick={() => action('onNotificationClick')}
            onDismissNotification={this.onDismissNotification}
          />
        </div>
        <PfContainerNavVertical>
          <h2>Press to add a message</h2>
          <ButtonGroup>
            <Button onClick={() => this.addMessage('default', 'Good', MessageType.SUCCESS)} bsStyle="success">
              Success
            </Button>
            <Button onClick={() => this.addMessage('default', 'Info', MessageType.INFO)} bsStyle="info">
              Info
            </Button>
            <Button onClick={() => this.addMessage('default', 'Warning!!', MessageType.WARNING)} bsStyle="warning">
              Warning
            </Button>
            <Button
              onClick={() => this.addMessage('default', 'Run for your lives!', MessageType.ERROR)}
              bsStyle="danger"
            >
              Error
            </Button>
          </ButtonGroup>
        </PfContainerNavVertical>
      </>
    );
  }
}

storiesOf('MessageCenter', module).add('MessageCenter', () => <StorybookStatefulMessageCenter />);
