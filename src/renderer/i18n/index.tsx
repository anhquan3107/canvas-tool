import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AppLocale } from "@shared/types/project";
import { en, type LocaleMessages } from "@renderer/i18n/locales/en";
import { vi } from "@renderer/i18n/locales/vi";

const LOCALE_CHANNEL_NAME = "canvastool.locale";
const LOCALE_MESSAGES: Record<AppLocale, LocaleMessages> = {
  en,
  vi,
};

const normalizeLocale = (locale: AppLocale | null | undefined): AppLocale =>
  locale === "vi" ? "vi" : "en";

export const getLocaleMessages = (locale?: AppLocale | null) =>
  LOCALE_MESSAGES[normalizeLocale(locale)];

export const getDocumentLocale = (): AppLocale => {
  if (typeof document === "undefined") {
    return "en";
  }

  return normalizeLocale(
    document.documentElement.dataset.appLocale as AppLocale | undefined,
  );
};

export const getDocumentMessages = () => getLocaleMessages(getDocumentLocale());

interface I18nContextValue {
  locale: AppLocale;
  copy: LocaleMessages;
  intlLocale: string;
  setLocale: (locale: AppLocale) => Promise<void>;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider = ({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: AppLocale;
}) => {
  const [locale, setLocaleState] = useState<AppLocale>(
    normalizeLocale(initialLocale),
  );
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (initialLocale) {
      setLocaleState(normalizeLocale(initialLocale));
    }
  }, [initialLocale]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.dataset.appLocale = locale;
    document.documentElement.lang = LOCALE_MESSAGES[locale].meta.intlLocale;
  }, [locale]);

  useEffect(() => {
    if (initialLocale) {
      return;
    }

    let cancelled = false;
    void window.desktopApi.app
      .getSettings()
      .then((settings) => {
        if (!cancelled) {
          setLocaleState(normalizeLocale(settings.locale));
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [initialLocale]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") {
      return;
    }

    const channel = new BroadcastChannel(LOCALE_CHANNEL_NAME);
    channelRef.current = channel;

    channel.addEventListener("message", (event: MessageEvent<{ locale?: AppLocale }>) => {
      const nextLocale = normalizeLocale(event.data?.locale);
      setLocaleState(nextLocale);
    });

    return () => {
      channel.close();
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
    };
  }, []);

  const setLocale = useCallback(async (nextLocale: AppLocale) => {
    const normalized = normalizeLocale(nextLocale);
    const previousLocale = locale;

    setLocaleState(normalized);
    channelRef.current?.postMessage({ locale: normalized });

    try {
      const savedLocale = await window.desktopApi.app.saveLocale(normalized);
      const persistedLocale = normalizeLocale(savedLocale);
      setLocaleState(persistedLocale);
      channelRef.current?.postMessage({ locale: persistedLocale });
    } catch {
      setLocaleState(previousLocale);
      channelRef.current?.postMessage({ locale: previousLocale });
    }
  }, [locale]);

  const copy = LOCALE_MESSAGES[locale];
  const value = useMemo(
    () => ({
      locale,
      copy,
      intlLocale: copy.meta.intlLocale,
      setLocale,
    }),
    [copy, locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider.");
  }

  return context;
};

export type { LocaleMessages };
