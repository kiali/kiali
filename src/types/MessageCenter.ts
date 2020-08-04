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
  title: string;
  messages: NotificationMessage[];
  showActions: boolean;
  hideIfEmpty: boolean;
}
