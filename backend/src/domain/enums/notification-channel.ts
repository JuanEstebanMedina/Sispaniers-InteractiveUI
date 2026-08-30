export const NOTIFICATION_CHANNELS = ["email", "slack"] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
