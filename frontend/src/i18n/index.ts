import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import enAuth from './locales/en/auth.json'
import enCommon from './locales/en/common.json'
import enDomain from './locales/en/domain.json'
import enErrors from './locales/en/errors.json'
import enValidation from './locales/en/validation.json'

import esAuth from './locales/es/auth.json'
import esCommon from './locales/es/common.json'
import esDomain from './locales/es/domain.json'
import esErrors from './locales/es/errors.json'
import esValidation from './locales/es/validation.json'

import ptAuth from './locales/pt-BR/auth.json'
import ptCommon from './locales/pt-BR/common.json'
import ptDomain from './locales/pt-BR/domain.json'
import ptErrors from './locales/pt-BR/errors.json'
import ptValidation from './locales/pt-BR/validation.json'

export const SUPPORTED_LOCALES = ['es', 'en', 'pt-BR'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'es'

export const LOCALE_LABELS: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
  'pt-BR': 'Português (BR)',
}

export const INTL_LOCALES: Record<Locale, string> = {
  es: 'es-CO',
  en: 'en-US',
  'pt-BR': 'pt-BR',
}

export const defaultNS = 'common'

export const resources = {
  es: {
    common: esCommon,
    auth: esAuth,
    errors: esErrors,
    validation: esValidation,
    domain: esDomain,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    errors: enErrors,
    validation: enValidation,
    domain: enDomain,
  },
  'pt-BR': {
    common: ptCommon,
    auth: ptAuth,
    errors: ptErrors,
    validation: ptValidation,
    domain: ptDomain,
  },
} as const

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    defaultNS,
    // Every screen calls shared strings like `actions.cancel` without
    // prefixing the namespace — this is what makes that resolve even from a
    // component whose own `useTranslation(...)` only lists its own namespace.
    fallbackNS: 'common',
    ns: ['common', 'auth', 'errors', 'validation', 'domain'],
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],

    /**
     * `nonExplicitSupportedLngs` estaba en true y rompía el portugués.
     *
     * La opción TRUNCA el código entrante antes de compararlo con
     * supportedLngs: 'pt-BR' se convertía en 'pt', que no está en la lista, y
     * el idioma caía a español sin decir nada. Sirve cuando en supportedLngs
     * ponés la base ('pt') y querés aceptar las variantes; acá tenemos la
     * variante concreta, así que sobra.
     *
     * Sin la opción, los cuatro casos que importan resuelven bien:
     *   pt-BR → pt-BR    pt → pt-BR    es-CO → es    en-GB → en
     */

    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'yn.locale',
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false,
    },

    returnNull: false,
  })

export function setLocale(locale: Locale): void {
  void i18n.changeLanguage(locale)
  document.documentElement.lang = locale
}

export function currentLocale(): Locale {
  const language = i18n.resolvedLanguage ?? i18n.language
  return (SUPPORTED_LOCALES as readonly string[]).includes(language)
    ? (language as Locale)
    : DEFAULT_LOCALE
}

export function currentIntlLocale(): string {
  return INTL_LOCALES[currentLocale()]
}

export const t = i18n.t.bind(i18n)

export { i18n }
