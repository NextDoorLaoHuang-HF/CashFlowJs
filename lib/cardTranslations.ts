import type { Locale } from "./types";
import { cardStringTranslationsZh } from "./data/cardStrings.zh";

type CardTranslationRecord = Record<string, string>;

const cardTranslations: Record<Locale, CardTranslationRecord> = {
  en: {},
  zh: cardStringTranslationsZh
};

export const translateCardText = (locale: Locale, text: string): string => {
  if (locale === "en") return text;

  const dictionary = cardTranslations[locale] ?? cardTranslations.en;
  return dictionary[text] ?? text;
};
