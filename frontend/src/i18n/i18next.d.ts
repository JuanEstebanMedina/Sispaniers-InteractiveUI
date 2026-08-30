import type { defaultNS } from './index'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS
    returnNull: false
  }
}
