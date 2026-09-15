"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import {
  formatDate,
  formatDateTime,
  formatDurationI18n,
  formatFullDate,
  formatTime,
  formatWeekday,
  intlLocale,
  translate,
} from "@/lib/i18n";
import { hydrateLocale, primeLocale, setLocale, useLocale } from "@/lib/i18n/store";
import type { Locale } from "@/lib/i18n/types";

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (path: string, vars?: Record<string, string | number>) => string;
  intl: string;
  formatDateTime: (value: string | Date) => string;
  formatDate: (value: string | Date) => string;
  formatTime: (value: string | Date) => string;
  formatWeekday: (value: Date) => string;
  formatFullDate: (value: string | Date) => string;
  formatDuration: (ms: number) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  useEffect(() => {
    hydrateLocale(initialLocale);
  }, [initialLocale]);

  primeLocale(initialLocale);

  const locale = useLocale();

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      t: (path, vars) => translate(path, vars, locale),
      intl: intlLocale(locale),
      formatDateTime: (value) => formatDateTime(value, locale),
      formatDate: (value) => formatDate(value, locale),
      formatTime: (value) => formatTime(value, locale),
      formatWeekday: (value) => formatWeekday(value, locale),
      formatFullDate: (value) => formatFullDate(value, locale),
      formatDuration: (ms) => formatDurationI18n(ms, locale),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  const locale = useLocale();
  if (context) return context;
  return {
    locale,
    setLocale,
    t: (path: string, vars?: Record<string, string | number>) =>
      translate(path, vars, locale),
    intl: intlLocale(locale),
    formatDateTime: (value: string | Date) => formatDateTime(value, locale),
    formatDate: (value: string | Date) => formatDate(value, locale),
    formatTime: (value: string | Date) => formatTime(value, locale),
    formatWeekday: (value: Date) => formatWeekday(value, locale),
    formatFullDate: (value: string | Date) => formatFullDate(value, locale),
    formatDuration: (ms: number) => formatDurationI18n(ms, locale),
  };
}
