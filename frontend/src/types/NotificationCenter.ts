// should match the PF variant types: 'success' | 'danger' | 'warning' | 'info'
export enum MessageType {
  DANGER = 'danger',
  WARNING = 'warning',
  SUCCESS = 'success',
  INFO = 'info'
}

export interface NotificationMessage {
  content: string;
  count: number; // how many times did this message occur
  created: Date;
  detail: string;
  firstTriggered?: Date; // when was it first triggered
  groupId?: string;
  id: number;
  isAlert: boolean;
  seen: boolean;
  showDetail: boolean;
  type: MessageType;
}

export interface NotificationGroup {
  id: string;
  messages: NotificationMessage[];
  title: string;
  variant: 'success' | 'danger' | 'warning' | 'info';
}
