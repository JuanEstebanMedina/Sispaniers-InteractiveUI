export type NotificationChannel = "email" | "slack";

export interface Client {
  id: string;
  name: string;
  contactEmail: string;
  preferredNotificationChannel: NotificationChannel;
}
