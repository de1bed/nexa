"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
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
import { setLocale as persistLocale } from "@/lib/i18n/store";
import {
  LOCALE_STORAGE_KEY,
  isLocale,
  type Locale,
} from "@/lib/i18n/types";

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (path: string, vars?: Record<string, string | number>) => string;
  intl: string;
  formatDateTime: (
    value: string | Date | null | undefined,
    timeZone?: string | null,
  ) => string;
  formatDate: (
    value: string | Date | null | undefined,
    timeZone?: string | null,
  ) => string;
  formatTime: (
    value: string | Date | null | undefined,
    timeZone?: string | null,
  ) => string;
  formatWeekday: (value: Date, timeZone?: string | null) => string;
  formatFullDate: (value: string | Date, timeZone?: string | null) => string;
  formatDuration: (ms: number) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  children,
  initialLocale = "es",
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(
    isLocale(initialLocale) ? initialLocale : "es",
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isLocale(stored) && stored !== locale) {
        setLocaleState(stored);
        persistLocale(stored);
        return;
      }
    } catch {
      // almacenamiento bloqueado
    }
    persistLocale(locale);
    // Solo al montar: el idioma elegido en este dispositivo manda sobre la cookie del servidor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      t: (path, vars) => translate(path, vars, locale),
      intl: intlLocale(locale),
      formatDateTime: (value, timeZone) =>
        formatDateTime(value, locale, timeZone),
      formatDate: (value, timeZone) => formatDate(value, locale, timeZone),
      formatTime: (value, timeZone) => formatTime(value, locale, timeZone),
      formatWeekday: (value, timeZone) =>
        formatWeekday(value, locale, timeZone),
      formatFullDate: (value, timeZone) =>
        formatFullDate(value, locale, timeZone),
      formatDuration: (ms) => formatDurationI18n(ms, locale),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
