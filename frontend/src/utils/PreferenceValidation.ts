import { ColorScheme, ContrastMode, Language, Theme } from 'types/Common';

export type ResolvedLanguage = Language.CHINESE | Language.ENGLISH | Language.KOREAN | Language.SPANISH;

export const isSupportedLanguage = (language: string | null | undefined): language is ResolvedLanguage => {
  return (
    language === Language.CHINESE ||
    language === Language.ENGLISH ||
    language === Language.KOREAN ||
    language === Language.SPANISH
  );
};

export const isLanguagePreference = (language: string | null | undefined): language is Language => {
  return isSupportedLanguage(language) || language === Language.SYSTEM;
};

export const isColorScheme = (colorScheme: string | null | undefined): colorScheme is ColorScheme => {
  return colorScheme === ColorScheme.LIGHT || colorScheme === ColorScheme.DARK || colorScheme === ColorScheme.SYSTEM;
};

export const isContrastMode = (contrastMode: string | null | undefined): contrastMode is ContrastMode => {
  return (
    contrastMode === ContrastMode.DEFAULT ||
    contrastMode === ContrastMode.GLASS ||
    contrastMode === ContrastMode.HIGH_CONTRAST ||
    contrastMode === ContrastMode.SYSTEM
  );
};

export const isTheme = (theme: string | null | undefined): theme is Theme => {
  return theme === Theme.DEFAULT || theme === Theme.FELT;
};

/** Older builds stored light/dark preference in `theme` instead of `colorScheme`. */
export const isLegacyColorSchemeTheme = (
  theme: string | null | undefined
): theme is ColorScheme.LIGHT | ColorScheme.DARK => {
  return theme === ColorScheme.LIGHT || theme === ColorScheme.DARK;
};
