import type { NotificationChannel } from "../enums/notification-channel.js";

export interface Company {
  id: string;
  name: string;
  contactEmails: string[];
  preferredNotificationChannel: NotificationChannel;
  /**
   * A disabled company is never deleted — its data (and every operation that
   * references it) stays intact. Disabling just takes it out of active use;
   * re-enabling is the same PATCH with `active: true`.
   */
  active: boolean;
}
