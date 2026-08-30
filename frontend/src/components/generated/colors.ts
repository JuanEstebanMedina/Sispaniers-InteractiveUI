export const COLOR_NAMES = [
  'default',
  'muted',
  'subtle',
  'agent',
  'brand',
  'accent',
  'success',
  'warning',
  'danger',
  'info',
] as const

export type ColorName = (typeof COLOR_NAMES)[number]

export const TEXT_COLOR: Record<ColorName, string> = {
  default: 'text-fg',
  muted: 'text-fg-muted',
  subtle: 'text-fg-subtle',
  agent: 'text-agent',
  brand: 'text-brand',
  accent: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
}

export const SOLID_COLOR: Record<ColorName, string> = {
  default: 'bg-fg',
  muted: 'bg-fg-muted',
  subtle: 'bg-fg-subtle',
  agent: 'bg-agent',
  brand: 'bg-brand',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
}

export const SOFT_COLOR: Record<ColorName, string> = {
  default: 'bg-surface text-fg border-line',
  muted: 'bg-surface-hover text-fg-muted border-line',
  subtle: 'bg-surface-sunken text-fg-subtle border-line-subtle',
  agent: 'bg-agent-subtle text-agent border-agent/25',
  brand: 'bg-brand-subtle text-brand border-brand/25',
  accent: 'bg-accent-subtle text-accent border-accent/25',
  success: 'bg-success-subtle text-success-fg border-success/25',
  warning: 'bg-warning-subtle text-warning-fg border-warning/25',
  danger: 'bg-danger-subtle text-danger-fg border-danger/25',
  info: 'bg-info-subtle text-info-fg border-info/25',
}

export const CHART_COLOR: Record<ColorName, string> = {
  default: 'var(--color-fg)',
  muted: 'var(--color-fg-muted)',
  subtle: 'var(--color-fg-subtle)',
  agent: 'var(--color-agent)',
  brand: 'var(--color-brand)',
  accent: 'var(--color-accent)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
}

export function isColorName(value: unknown): value is ColorName {
  return typeof value === 'string' && (COLOR_NAMES as readonly string[]).includes(value)
}
