export enum MessageType {
  ERROR = 'error',
  WARNING = 'warning',
  SUCCESS = 'success',
  INFO = 'info'
}

export interface NotificationMessage {
  id: number;
  seen: boolean;
  type: MessageType;
  content: string;
  created: Date;
  firstTriggered?: Date; // when was it first triggered
  count: number; // how many times did this message occur

  show_notification?: boolean;
  groupId?: string;
}

export interface NotificationGroup {
  id: string;
  title: string;
  messages: NotificationMessage[];
  showActions: boolean;
  hideIfEmpty: boolean;
}

export interface MessageCenterPropsType {
  drawerTitle: string;
  drawerIsHidden?: boolean;
  drawerIsExpanded?: boolean;
  drawerExpandedGroupId?: string;
  drawerReverseMessageOrder?: boolean;

  onExpandDrawer: () => void;
  onHideDrawer: () => void;
  onToggleGroup: (group: NotificationGroup) => void;
  onMarkGroupAsRead: (group: NotificationGroup) => void;
  onClearGroup: (group: NotificationGroup) => void;
  onNotificationClick: (message: NotificationMessage, group: NotificationGroup) => void;

  onDismissNotification: (message: NotificationMessage, group: NotificationGroup, userDismissed: boolean) => void;

  groups: NotificationGroup[];
}
