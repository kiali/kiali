import { i18n } from 'i18n';
import { TOptions } from 'i18next';
import { UseTranslationResponse, useTranslation } from 'react-i18next';

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
