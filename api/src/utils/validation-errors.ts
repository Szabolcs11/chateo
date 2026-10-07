import type { ZodIssue } from "zod";

import type { Language, MessageKey } from "./localization.js";
import { translate } from "./localization.js";

export type LocalizedValidationError = {
  field: string;
  key: MessageKey;
  message: string;
};

export function formatValidationErrors(
  issues: ZodIssue[],
  language: Language
): LocalizedValidationError[] {
  return issues.map((issue) => {
    const key = getValidationMessageKey(issue);

    return {
      field: issue.path.join("."),
      key,
      message: translate(key, language)
    };
  });
}

function getValidationMessageKey(issue: ZodIssue): MessageKey {
  if (issue.code === "invalid_type" && issue.received === "undefined") {
    return "validation.required";
  }

  if (issue.code === "invalid_string" && issue.validation === "email") {
    return "validation.invalidEmail";
  }

  if (issue.code === "too_small") {
    return issue.type === "string" ? "validation.stringTooShort" : "validation.numberTooSmall";
  }

  if (issue.code === "too_big") {
    return issue.type === "string" ? "validation.stringTooLong" : "validation.numberTooBig";
  }

  if (issue.code === "invalid_enum_value") {
    return "validation.invalidEnum";
  }

  if (issue.code === "invalid_date") {
    return "validation.invalidDate";
  }

  if (issue.code === "invalid_type") {
    return "validation.invalidType";
  }

  return "validation.unknown";
}
