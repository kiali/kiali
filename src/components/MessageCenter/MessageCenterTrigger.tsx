import * as React from 'react';
import { ThunkDispatch } from 'redux-thunk';
import { connect } from 'react-redux';
import { Badge, Button, ButtonVariant } from '@patternfly/react-core';
import { BellIcon, WarningTriangleIcon } from '@patternfly/react-icons';
import { KialiAppState } from '../../store/Store';
import { MessageType, NotificationGroup, NotificationMessage } from '../../types/MessageCenter';
import { KialiAppAction } from '../../actions/KialiAppAction';
import MessageCenterThunkActions from '../../actions/MessageCenterThunkActions';

type PropsType = {
  newMessagesCount: number;
  systemErrorsCount: number;
  badgeDanger: boolean;
  toggleMessageCenter: () => void;
  toggleSystemErrorsCenter: () => void;
};

export class MessageCenterTrigger extends React.PureComponent<PropsType, {}> {
  render() {
    return (
      <>
        {this.renderSystemErrorBadge()}
        {this.renderMessageCenterBadge()}
      </>
    );
  }

  private renderSystemErrorBadge = () => {
    if (this.props.systemErrorsCount === 0) {
      return null;
    }

    return (
      <Button
        id={'icon_warning'}
        aria-label={'SystemError'}
        onClick={this.props.toggleSystemErrorsCenter}
        variant={ButtonVariant.plain}
      >
        <WarningTriangleIcon />
        {this.props.systemErrorsCount}
        {this.props.systemErrorsCount === 1 ? ' Open Issue' : ' Open Issues'}
      </Button>
    );
  };

  private renderMessageCenterBadge = () => {
    return (
      <Button
        id={'bell_icon_warning'}
        aria-label={'Notifications'}
        onClick={this.props.toggleMessageCenter}
        variant={ButtonVariant.plain}
      >
        <BellIcon />
        {this.props.newMessagesCount > 0 && (
          <Badge className={'pf-badge-bodered' + (this.props.badgeDanger ? ' badge-danger' : '')}>
            {this.props.newMessagesCount > 0 ? this.props.newMessagesCount : ' '}
          </Badge>
        )}
      </Button>
    );
  };
}

const mapStateToPropsMessageCenterTrigger = (state: KialiAppState) => {
  type MessageCenterTriggerPropsToMap = {
    newMessagesCount: number;
    badgeDanger: boolean;
    systemErrorsCount: number;
  };

  const dangerousMessageTypes = [MessageType.ERROR, MessageType.WARNING];
  let systemErrorsCount = 0;

  const systemErrorsGroup = state.messageCenter.groups.find(item => item.id === 'systemErrors');
  if (systemErrorsGroup) {
    systemErrorsCount = systemErrorsGroup.messages.length;
  }

  return state.messageCenter.groups
    .reduce((unreadMessages: NotificationMessage[], group: NotificationGroup) => {
      return unreadMessages.concat(
        group.messages.reduce((unreadMessagesInGroup: NotificationMessage[], message: NotificationMessage) => {
          if (!message.seen) {
            unreadMessagesInGroup.push(message);
          }
          return unreadMessagesInGroup;
        }, [])
      );
    }, [])
    .reduce(
      (propsToMap: MessageCenterTriggerPropsToMap, message: NotificationMessage) => {
        propsToMap.newMessagesCount++;
        propsToMap.badgeDanger = propsToMap.badgeDanger || dangerousMessageTypes.includes(message.type);
        return propsToMap;
      },
      { newMessagesCount: 0, systemErrorsCount: systemErrorsCount, badgeDanger: false }
    );
};

const mapDispatchToPropsMessageCenterTrigger = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    toggleMessageCenter: () => dispatch(MessageCenterThunkActions.toggleMessageCenter()),
    toggleSystemErrorsCenter: () => dispatch(MessageCenterThunkActions.toggleSystemErrorsCenter())
  };
};

const MessageCenterTriggerContainer = connect(
  mapStateToPropsMessageCenterTrigger,
  mapDispatchToPropsMessageCenterTrigger
)(MessageCenterTrigger);
export default MessageCenterTriggerContainer;
