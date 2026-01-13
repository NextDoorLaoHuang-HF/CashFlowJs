"use client";

import { useGameStore } from "../lib/state/gameStore";
import { availableLocales, t } from "../lib/i18n";

export function LocalizationToggle() {
  const { locale, setLocale } = useGameStore((state) => ({
    locale: state.settings.locale,
    setLocale: state.setLocale
  }));

  const nextLocale = availableLocales.find((item) => item !== locale) ?? "en";

  return (
    <button
      data-tour="locale-toggle"
      onClick={() => setLocale(nextLocale)}
      style={{
        borderRadius: 999,
        padding: "0.45rem 1rem",
        background: "rgba(255,255,255,0.08)",
        color: "#fff"
      }}
    >
      {locale === "en" ? t(locale, "locale.toggle") : t(locale, "locale.toggleBack")}
    </button>
  );
}
