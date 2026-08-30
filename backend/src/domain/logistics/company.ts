import type { NotificationChannel } from "../enums/notification-channel.js";

export interface Company {
  id: string;
  name: string;
  contactEmails: string[];
  operationIds: string[];
  preferredNotificationChannel: NotificationChannel;
}
