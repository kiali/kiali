import * as React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  Button,
  CardBody,
  Accordion,
  AccordionToggle,
  AccordionItem,
  AccordionContent,
  ButtonVariant
} from '@patternfly/react-core';
import { CloseIcon, InfoIcon } from '@patternfly/react-icons';
import { connect } from 'react-redux';
import { KialiDispatch } from 'types/Redux';
import { KialiAppState } from 'store/Store';
import { kialiStyle } from 'styles/StyleUtils';
import { NotificationMessage, NotificationGroup } from '../../types/MessageCenter';
import { MessageCenterActions } from 'actions/MessageCenterActions';
import { AlertDrawerGroup } from './AlertDrawerGroup';
import {
  BoundingClientAwareComponent,
  PropertyType
} from 'components/BoundingClientAwareComponent/BoundingClientAwareComponent';
import { KialiIcon } from 'config/KialiIcon';

type ReduxProps = {
  expandedGroupId: string | undefined;
  groups: NotificationGroup[];
  isExpanded: boolean;
  isHidden: boolean;

  expandDrawer: () => void;
  hideDrawer: () => void;
  toggleGroup: (group) => void;
};

type AlertDrawerProps = ReduxProps & {
  title: string;
};

const hideGroup = (group: NotificationGroup): boolean => {
  return group.hideIfEmpty && group.messages.length === 0;
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

const noNotificationsMessage = (
  <>
    <InfoIcon />
    No Messages Available
  </>
);

class AlertDrawerComponent extends React.PureComponent<AlertDrawerProps> {
  static readonly head = kialiStyle({
    paddingBottom: 0
  });
  static readonly body = kialiStyle({
    paddingLeft: 0,
    paddingRight: 0
  });
  static readonly wrapper = kialiStyle({
    overflow: 'auto'
  });
  static readonly wrapperMarginBottom = 10;
  static readonly groups = kialiStyle({
    paddingTop: 0,
    paddingBottom: 0
  });

  render() {
    const drawer = kialiStyle({
      position: 'absolute',
      right: '0',
      width: this.props.isExpanded ? '80%' : '30em'
    });

    return (
      !this.props.isHidden && (
        <Card className={drawer} hidden={this.props.isHidden}>
          <CardHeader
            actions={{
              actions: (
                <>
                  {this.props.isExpanded ? (
                    <Button icon={<KialiIcon.AngleDoubleRight />} id="alert_drawer_collapse" variant={ButtonVariant.plain} onClick={this.props.expandDrawer} />
                  ) : (
                    <Button icon={<KialiIcon.AngleDoubleLeft />} id="alert_drawer_expand" variant={ButtonVariant.plain} onClick={this.props.expandDrawer} />
                  )}
                  <Button icon={<CloseIcon />} id="alert_drawer_close" variant={ButtonVariant.plain} onClick={this.props.hideDrawer} />
                </>
              ),
              hasNoOffset: false,
              className: undefined
            }}
            className={AlertDrawerComponent.head}
          >
            <CardTitle>{this.props.title}</CardTitle>
          </CardHeader>
          <CardBody className={AlertDrawerComponent.body}>
            {this.props.groups.length === 0 ? (
              noNotificationsMessage
            ) : (
              <BoundingClientAwareComponent
                className={AlertDrawerComponent.wrapper}
                maxHeight={{
                  type: PropertyType.VIEWPORT_HEIGHT_MINUS_TOP,
                  margin: AlertDrawerComponent.wrapperMarginBottom
                }}
              >
                <Accordion className={AlertDrawerComponent.groups}>
                  {this.props.groups.map(group => {
                    return hideGroup(group) ? null : (
                      <AccordionItem isExpanded={group.id === this.props.expandedGroupId} key={group.id + '_item'}>
                        <AccordionToggle
                          id={group.id + '_toggle'}
                          
                          onClick={() => {
                            this.props.toggleGroup(group);
                          }}
                        >
                          {group.title} {getUnreadMessageLabel(group.messages)}
                        </AccordionToggle>
                        <AccordionContent id={group.id + '_content'} >
                          <AlertDrawerGroup key={group.id} group={group} />
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </BoundingClientAwareComponent>
            )}
          </CardBody>
        </Card>
      )
    );
  }
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    expandedGroupId: state.messageCenter.expandedGroupId,
    groups: state.messageCenter.groups,
    isExpanded: state.messageCenter.expanded,
    isHidden: state.messageCenter.hidden
  };
};

const mapDispatchToProps = (dispatch: KialiDispatch) => {
  return {
    expandDrawer: () => dispatch(MessageCenterActions.toggleExpandedMessageCenter()),
    hideDrawer: () => dispatch(MessageCenterActions.hideMessageCenter()),
    toggleGroup: group => dispatch(MessageCenterActions.toggleGroup(group.id))
  };
};

export const AlertDrawer = connect(mapStateToProps, mapDispatchToProps)(AlertDrawerComponent);
