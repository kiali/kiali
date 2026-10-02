import { i18n } from 'i18n';
import type { TOptions } from 'i18next';
import type { UseTranslationResponse } from 'react-i18next';
import { useTranslation } from 'react-i18next';

const I18N_NAMESPACE = process.env.I18N_NAMESPACE;

/**
 * Hook for using the i18n translation with I18_NAMESPACE namespace.
 */
export const useKialiTranslation = (): UseTranslationResponse<string, undefined> => {
  return useTranslation(I18N_NAMESPACE);
};

/**
 * Function to perform translation to I18_NAMESPACE namespace
 * @param value string to translate
 * @param options (optional) options for traslations
 */
export const t = (value: string, options?: TOptions): string => {
  return i18n?.isInitialized ? i18n.t(value, { ns: I18N_NAMESPACE, ...options }) : value;
};

/**
 * Function to tranlate maps (key-value pair objects)
 * @param value map to translate
 * @param options (optional) options for traslations
 */
export const tMap = (value: { [key: string]: string }, options?: TOptions): { [key: string]: string } => {
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, t(v, options)]));
};

/** Leading integer from duration labels such as "5m" or "1h". Defaults to 2 for plural _other form. */
export const parseDurationLabelCount = (durationLabel: string): number => {
  const match = /^(\d+)/.exec(durationLabel.trim());
  return match ? Number.parseInt(match[1], 10) : 2;
};

export const formatLastDuration = (durationLabel: string): string => {
  return t('Last {{duration}}', { count: parseDurationLabelCount(durationLabel), duration: durationLabel });
};

export const formatTrafficStatusLastDuration = (durationLabel: string): string => {
  return t('Traffic Status (Last {{duration}})', {
    count: parseDurationLabelCount(durationLabel),
    duration: durationLabel
  });
};
