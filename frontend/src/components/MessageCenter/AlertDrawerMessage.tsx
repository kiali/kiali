import * as React from 'react';
import { connect } from 'react-redux';
import { ExpandableSection, Card, CardBody } from '@patternfly/react-core';
import { MessageType, NotificationMessage } from '../../types/MessageCenter';
import moment from 'moment';
import { MessageCenterActions } from 'actions/MessageCenterActions';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppState } from 'store/Store';
import { style } from 'typestyle';
import { KialiAppAction } from 'actions/KialiAppAction';
import { KialiIcon } from 'config/KialiIcon';

const getIcon = (type: MessageType) => {
  switch (type) {
    case MessageType.ERROR:
      return <KialiIcon.Error />;
    case MessageType.INFO:
      return <KialiIcon.Info />;
    case MessageType.SUCCESS:
      return <KialiIcon.Ok />;
    case MessageType.WARNING:
      return <KialiIcon.Warning />;
    default:
      throw Error('Unexpected type');
  }
};

type ReduxProps = {
  markAsRead: (message: NotificationMessage) => void;
  toggleMessageDetail: (message: NotificationMessage) => void;
};

type AlertDrawerMessageProps = ReduxProps & {
  message: NotificationMessage;
};

class AlertDrawerMessage extends React.PureComponent<AlertDrawerMessageProps> {
  static readonly body = style({
    paddingTop: 0
  });
  static readonly left = style({
    float: 'left'
  });
  static readonly right = style({
    float: 'right'
  });

  render() {
    return (
      <Card>
        <CardBody className={AlertDrawerMessage.body}>
          {getIcon(this.props.message.type)}{' '}
          {this.props.message.seen ? this.props.message.content : <b>{this.props.message.content}</b>}
          {this.props.message.detail && (
            <ExpandableSection
              toggleText={this.props.message.showDetail ? 'Hide Detail' : 'Show Detail'}
              onToggle={() => this.props.toggleMessageDetail(this.props.message)}
              isExpanded={this.props.message.showDetail}
            >
              <pre style={{ whiteSpace: 'pre-wrap' }}>{this.props.message.detail}</pre>
            </ExpandableSection>
          )}
          {this.props.message.count > 1 && (
            <div>
              {this.props.message.count} {moment().from(this.props.message.firstTriggered)}
            </div>
          )}
          <div>
            <span className={AlertDrawerMessage.left}>{this.props.message.created.toLocaleDateString()}</span>
            <span className={AlertDrawerMessage.right}>{this.props.message.created.toLocaleTimeString()}</span>
          </div>
        </CardBody>
      </Card>
    );
  }
}

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    markAsRead: message => dispatch(MessageCenterActions.markAsRead(message.id)),
    toggleMessageDetail: message => dispatch(MessageCenterActions.toggleMessageDetail(message.id))
  };
};

const AlertDrawerMessageContainer = connect(null, mapDispatchToProps)(AlertDrawerMessage);
export default AlertDrawerMessageContainer;
