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

  show_notification?: boolean;
  groupId?: string;
}

export interface NotificationGroup {
  id: string;
  title: string;
  messages: NotificationMessage[];
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
