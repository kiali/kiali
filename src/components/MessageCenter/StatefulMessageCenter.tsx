import * as React from 'react';

import MessageCenter from './MessageCenter';
import { MessageCenterPropsType, NotificationGroup, NotificationMessage } from './Types';

type StateType = {
  drawerIsHidden: boolean;
  drawerIsExpanded: boolean;
  drawerExpandedGroupId?: string;
};

type StatefulMessageCenterPropsType = {
  drawerTitle: string;
  drawerIsHidden?: boolean;
  drawerIsExpanded?: boolean;
  drawerExpandedGroupId?: string;
  drawerReverseMessageOrder?: boolean;

  onExpandDrawer?: () => void;
  onHideDrawer?: () => void;
  onToggleGroup?: (group: NotificationGroup) => void;
  onMarkGroupAsRead: (group: NotificationGroup) => void;
  onClearGroup: (group: NotificationGroup) => void;
  onNotificationClick: (message: NotificationMessage, group: NotificationGroup) => void;

  onDismissNotification: (message: NotificationMessage, group: NotificationGroup) => void;

  groups: NotificationGroup[];
};

export default class StatefulMessageCenter extends React.PureComponent<StatefulMessageCenterPropsType, StateType> {
  constructor(props: MessageCenterPropsType) {
    super(props);
    this.state = {
      drawerIsHidden: this.props.drawerIsHidden === undefined ? true : this.props.drawerIsHidden,
      drawerIsExpanded: this.props.drawerIsExpanded === undefined ? false : this.props.drawerIsExpanded,
      drawerExpandedGroupId: this.props.drawerExpandedGroupId
    };
  }

  toggleDrawer = () => {
    this.setState(prevState => ({
      drawerIsHidden: !prevState.drawerIsHidden
    }));
  };

  onToggleGroup = (group: NotificationGroup) => {
    this.setState(prevState => ({
      drawerExpandedGroupId: group.id === prevState.drawerExpandedGroupId ? undefined : group.id
    }));
    if (this.props.onToggleGroup) {
      this.props.onToggleGroup(group);
    }
  };

  onExpandDrawer = () => {
    this.setState(prevState => {
      return { drawerIsExpanded: !prevState.drawerIsExpanded };
    });
    if (this.props.onExpandDrawer) {
      this.props.onExpandDrawer();
    }
  };

  onHideDrawer = () => {
    this.setState({
      drawerIsHidden: true
    });
    if (this.props.onHideDrawer) {
      this.props.onHideDrawer();
    }
  };

  render() {
    return (
      <MessageCenter
        {...this.props}
        onToggleGroup={this.onToggleGroup}
        onExpandDrawer={this.onExpandDrawer}
        onHideDrawer={this.onHideDrawer}
        drawerIsHidden={this.state.drawerIsHidden}
        drawerIsExpanded={this.state.drawerIsExpanded}
        drawerExpandedGroupId={this.state.drawerExpandedGroupId}
      />
    );
  }
}
