import * as React from 'react';
import { KialiDispatch } from 'types/Redux';
import { connect } from 'react-redux';
import { Button, ButtonVariant, NotificationBadge, NotificationBadgeVariant } from '@patternfly/react-core';
import { KialiAppState } from '../../store/Store';
import { MessageType, NotificationGroup, NotificationMessage } from '../../types/MessageCenter';
import { MessageCenterThunkActions } from '../../actions/MessageCenterThunkActions';
import { KialiIcon } from 'config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';
import { useKialiTranslation } from 'utils/I18nUtils';

type ReduxStateProps = {
  badgeDanger: boolean;
  newMessagesCount: number;
  systemErrorsCount: number;
};

type ReduxDispatchProps = {
  toggleMessageCenter: () => void;
  toggleSystemErrorsCenter: () => void;
};

type MessageCenterTriggerProps = ReduxStateProps & ReduxDispatchProps;

const systemErrorCountStyle = kialiStyle({
  marginLeft: '0.5rem'
});

const MessageCenterTriggerComponent: React.FC<MessageCenterTriggerProps> = (props: MessageCenterTriggerProps) => {
  const { t } = useKialiTranslation();

  const renderSystemErrorBadge = (): React.ReactNode => {
    if (props.systemErrorsCount === 0) {
      return null;
    }

    return (
      <Button
        id={'icon_warning'}
        aria-label={t('System Error')}
        onClick={props.toggleSystemErrorsCenter}
        variant={ButtonVariant.plain}
      >
        <KialiIcon.Warning />

        <span className={systemErrorCountStyle}>
          {t('{{count}} Open Issue', {
            count: props.systemErrorsCount,
            defaultValue_one: '{{count}} Open Issue',
            defaultValue_other: '{{count}} Open Issues'
          })}
        </span>
      </Button>
    );
  };

  const renderMessageCenterBadge = (): React.ReactNode => {
    let notificationVariant = NotificationBadgeVariant.read;

    if (props.newMessagesCount > 0) {
      if (props.badgeDanger) {
        notificationVariant = NotificationBadgeVariant.attention;
      } else {
        notificationVariant = NotificationBadgeVariant.unread;
      }
    }

    return (
      <NotificationBadge
        variant={notificationVariant}
        onClick={props.toggleMessageCenter}
        aria-label={t('Notification badge')}
        count={props.newMessagesCount}
      />
    );
  };

  return (
    <>
      {renderSystemErrorBadge()}
      {renderMessageCenterBadge()}
    </>
  );
};

const mapStateToPropsMessageCenterTrigger = (state: KialiAppState): ReduxStateProps => {
  type MessageCenterTriggerPropsToMap = {
    badgeDanger: boolean;
    newMessagesCount: number;
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

const mapDispatchToPropsMessageCenterTrigger = (dispatch: KialiDispatch): ReduxDispatchProps => {
  return {
    toggleMessageCenter: () => dispatch(MessageCenterThunkActions.toggleMessageCenter()),
    toggleSystemErrorsCenter: () => dispatch(MessageCenterThunkActions.toggleSystemErrorsCenter())
  };
};

export const MessageCenterTrigger = connect(
  mapStateToPropsMessageCenterTrigger,
  mapDispatchToPropsMessageCenterTrigger
)(MessageCenterTriggerComponent);
