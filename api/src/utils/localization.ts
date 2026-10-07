import messages from "../locales/error-messages.json";

export type Language = keyof typeof messages;
export type MessageKey = keyof (typeof messages)["en"];

const defaultLanguage: Language = "hu";
const supportedLanguages = Object.keys(messages) as Language[];

export function resolveLanguage(languageHeader: string | undefined): Language {
  if (!languageHeader) {
    return defaultLanguage;
  }

  const requestedLanguages = languageHeader
    .split(",")
    .map((language) => language.trim().split(";")[0]?.toLowerCase())
    .filter((language): language is string => Boolean(language));

  for (const requestedLanguage of requestedLanguages) {
    const baseLanguage = requestedLanguage.split("-")[0];

    if (isSupportedLanguage(requestedLanguage)) {
      return requestedLanguage;
    }

    if (baseLanguage && isSupportedLanguage(baseLanguage)) {
      return baseLanguage;
    }
  }

  return defaultLanguage;
}

export function translate(key: MessageKey, language: Language): string {
  return messages[language][key] ?? messages[defaultLanguage][key];
}

function isSupportedLanguage(language: string): language is Language {
  return supportedLanguages.includes(language as Language);
}
