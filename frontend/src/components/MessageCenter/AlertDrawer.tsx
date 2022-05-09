import * as React from 'react';
import {
  Card,
  CardActions,
  CardHeader,
  CardTitle,
  Button,
  CardBody,
  Accordion,
  AccordionToggle,
  AccordionItem,
  AccordionContent
} from '@patternfly/react-core';
import { CloseIcon, InfoIcon } from '@patternfly/react-icons';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppState } from 'store/Store';
import { style } from 'typestyle';
import { NotificationMessage, NotificationGroup } from '../../types/MessageCenter';
import { MessageCenterActions } from 'actions/MessageCenterActions';
import { KialiAppAction } from 'actions/KialiAppAction';
import AlertDrawerGroupContainer from './AlertDrawerGroup';
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

export class AlertDrawer extends React.PureComponent<AlertDrawerProps> {
  static readonly head = style({
    paddingBottom: 0
  });
  static readonly body = style({
    paddingLeft: 0,
    paddingRight: 0
  });
  static readonly wrapper = style({
    overflow: 'auto'
  });
  static readonly wrapperMarginBottom = 10;
  static readonly groups = style({
    paddingTop: 0,
    paddingBottom: 0
  });

  render() {
    const drawer = style({
      position: 'absolute',
      right: '0',
      width: this.props.isExpanded ? '80%' : '30em'
    });

    return (
      !this.props.isHidden && (
        <Card className={drawer} hidden={this.props.isHidden}>
          <CardHeader className={AlertDrawer.head}>
            <CardActions>
              {this.props.isExpanded ? (
                <Button id="alert_drawer_collapse" variant="plain" onClick={this.props.expandDrawer}>
                  <KialiIcon.AngleDoubleRight />
                </Button>
              ) : (
                <Button id="alert_drawer_expand" variant="plain" onClick={this.props.expandDrawer}>
                  <KialiIcon.AngleDoubleLeft />
                </Button>
              )}
              <Button id="alert_drawer_close" variant="plain" onClick={this.props.hideDrawer}>
                <CloseIcon />
              </Button>
            </CardActions>
            <CardTitle>{this.props.title}</CardTitle>
          </CardHeader>
          <CardBody className={AlertDrawer.body}>
            {this.props.groups.length === 0 ? (
              noNotificationsMessage
            ) : (
              <BoundingClientAwareComponent
                className={AlertDrawer.wrapper}
                maxHeight={{ type: PropertyType.VIEWPORT_HEIGHT_MINUS_TOP, margin: AlertDrawer.wrapperMarginBottom }}
              >
                <Accordion className={AlertDrawer.groups}>
                  {this.props.groups.map(group => {
                    return hideGroup(group) ? null : (
                      <AccordionItem key={group.id + '_item'}>
                        <AccordionToggle
                          id={group.id + '_toggle'}
                          isExpanded={group.id === this.props.expandedGroupId}
                          onClick={() => {
                            this.props.toggleGroup(group);
                          }}
                        >
                          {group.title} {getUnreadMessageLabel(group.messages)}
                        </AccordionToggle>
                        <AccordionContent id={group.id + '_content'} isHidden={group.id !== this.props.expandedGroupId}>
                          <AlertDrawerGroupContainer key={group.id} group={group} />
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

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    expandDrawer: () => dispatch(MessageCenterActions.toggleExpandedMessageCenter()),
    hideDrawer: () => dispatch(MessageCenterActions.hideMessageCenter()),
    toggleGroup: group => dispatch(MessageCenterActions.toggleGroup(group.id))
  };
};

const AlertDrawerContainer = connect(mapStateToProps, mapDispatchToProps)(AlertDrawer);
export default AlertDrawerContainer;
