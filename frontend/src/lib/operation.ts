import type { Operation } from '@/schemas'

/**
 * Whether an operation is asking for a person.
 *
 * The backend has no "waiting on a human" state: `status` is derived from the
 * containers and can only be one of the five real ones. Until the agent
 * publishes its own pauses, critical health is what claims attention.
 *
 * One function rather than the comparison written out at each call site — the
 * day the agent does publish a pause, this is the only place that changes.
 */
export function needsAttention(operation: Operation): boolean {
  return operation.health === 'critical'
}

/** Attention first, then whatever moved most recently. */
export function byUrgency(a: Operation, b: Operation): number {
  return (
    Number(needsAttention(b)) - Number(needsAttention(a)) ||
    Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  )
}
