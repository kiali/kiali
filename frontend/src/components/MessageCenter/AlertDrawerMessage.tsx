import * as React from 'react';
import { connect } from 'react-redux';
import { ExpandableSection, Card, CardBody } from '@patternfly/react-core';
import { MessageType, NotificationMessage } from '../../types/MessageCenter';
import moment from 'moment';
import { MessageCenterActions } from 'actions/MessageCenterActions';
import { KialiDispatch } from 'types/Redux';
import { kialiStyle } from 'styles/StyleUtils';
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

class AlertDrawerMessageComponent extends React.PureComponent<AlertDrawerMessageProps> {
  static readonly body = kialiStyle({
    paddingTop: 0
  });
  static readonly left = kialiStyle({
    float: 'left'
  });
  static readonly right = kialiStyle({
    float: 'right'
  });

  render() {
    return (
      <Card>
        <CardBody className={AlertDrawerMessageComponent.body}>
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
            <span className={AlertDrawerMessageComponent.left}>{this.props.message.created.toLocaleDateString()}</span>
            <span className={AlertDrawerMessageComponent.right}>{this.props.message.created.toLocaleTimeString()}</span>
          </div>
        </CardBody>
      </Card>
    );
  }
}

const mapDispatchToProps = (dispatch: KialiDispatch) => {
  return {
    markAsRead: message => dispatch(MessageCenterActions.markAsRead(message.id)),
    toggleMessageDetail: message => dispatch(MessageCenterActions.toggleMessageDetail(message.id))
  };
};

export const AlertDrawerMessage = connect(null, mapDispatchToProps)(AlertDrawerMessageComponent);
