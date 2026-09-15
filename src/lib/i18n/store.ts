"use client";

import { useSyncExternalStore } from "react";
import {
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  isLocale,
  type Locale,
} from "./types";

let current: Locale = "es";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function persist(locale: Locale) {
  current = locale;
  if (typeof document !== "undefined") {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = locale;
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // almacenamiento bloqueado: la cookie basta
    }
  }
  emit();
}

export function getLocale(): Locale {
  return current;
}

export function primeLocale(locale?: Locale) {
  if (locale && isLocale(locale)) current = locale;
}

export function setLocale(locale: Locale) {
  if (locale === current) {
    persist(locale);
    return;
  }
  persist(locale);
}

export function hydrateLocale(preferred?: Locale) {
  if (preferred && isLocale(preferred)) {
    if (current !== preferred) {
      current = preferred;
      emit();
    }
    return current;
  }
  if (typeof window === "undefined") return current;
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) {
      current = stored;
      emit();
      return current;
    }
  } catch {
    // ignore
  }
  current = "es";
  persist(current);
  return current;
}

export function subscribeLocale(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}
