// shold match the PF variant types: 'success' | 'danger' | 'warning' | 'info'
export enum MessageType {
  DANGER = 'danger',
  WARNING = 'warning',
  SUCCESS = 'success',
  INFO = 'info'
}

export interface NotificationMessage {
  id: number;
  seen: boolean;
  type: MessageType;
  content: string;
  detail: string;
  created: Date;
  firstTriggered?: Date; // when was it first triggered
  count: number; // how many times did this message occur
  showDetail: boolean;
  show_notification: boolean;
  groupId?: string;
}

export interface NotificationGroup {
  id: string;
  messages: NotificationMessage[];
  title: React.ReactNode;
  variant: 'success' | 'danger' | 'warning' | 'info';
  //showActions: boolean;
  //hideIfEmpty: boolean;
}
