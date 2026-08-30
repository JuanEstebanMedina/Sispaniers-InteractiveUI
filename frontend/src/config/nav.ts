import { Building2, Container, Users, Wrench, type LucideIcon } from 'lucide-react'

import type { Role } from '@/auth/roles'

export interface NavItem {
  labelKey: string
  to: string
  icon: LucideIcon
  /** Absent → any authenticated role can see it. */
  minRole?: Role
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
        badgeKey: 'decisions',
      },
    ],
  },
  {
    labelKey: 'admin',
    items: [
      { labelKey: 'companies', to: '/companies', icon: Building2, minRole: 'superadmin' },
      { labelKey: 'users', to: '/users', icon: Users, minRole: 'admin' },
    ],
  },
  {
    items: [
      { labelKey: 'components', to: '/components', icon: Wrench, devOnly: true },
    ],
  },
]
