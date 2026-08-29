import type { NotificationChannel } from "../enums/notification-channel.js";

export interface Client {
  id: string;
  name: string;
  contactEmail: string;
  preferredNotificationChannel: NotificationChannel;
}
