import { Container, Settings, Sparkles, Users, Wrench, type LucideIcon } from 'lucide-react'

import type { Permission } from '@/auth/roles'

export interface NavItem {
  labelKey: string
  to: string
  icon: LucideIcon
  anyOf?: readonly Permission[]
  badgeKey?: 'decisions' | 'notifications'
  devOnly?: boolean
}

export interface NavSection {
  labelKey?: string
  items: NavItem[]
}

export const navigation: NavSection[] = [
  {
    items: [
      {
        labelKey: 'operations',
        to: '/operations',
        icon: Container,
        anyOf: ['operations:read'],
        badgeKey: 'decisions',
      },
    ],
  },
  {
    labelKey: 'intelligence',
    items: [{ labelKey: 'assistant', to: '/assistant', icon: Sparkles, anyOf: ['ai:use'] }],
  },
  {
    labelKey: 'admin',
    items: [
      { labelKey: 'users', to: '/users', icon: Users, anyOf: ['users:read'] },
      { labelKey: 'settings', to: '/settings', icon: Settings, anyOf: ['settings:read'] },
    ],
  },
  {
    items: [
      { labelKey: 'components', to: '/components', icon: Wrench, devOnly: true },
    ],
  },
]
