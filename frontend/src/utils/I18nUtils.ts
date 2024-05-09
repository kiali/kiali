import { TOptions } from 'i18next';
import { UseTranslationResponse, getI18n, useTranslation, withTranslation } from 'react-i18next';
import { I18N_NAMESPACE } from 'types/Common';

/* eslint-disable @typescript-eslint/explicit-function-return-type*/
/* eslint-disable @typescript-eslint/explicit-module-boundary-types*/
export const withKialiTranslation = () => {
  return withTranslation(I18N_NAMESPACE);
};

/**
 * A Hook for using the i18n translation.
 */
export const useKialiTranslation = (): UseTranslationResponse<string, undefined> => {
  return useTranslation(I18N_NAMESPACE);
};

/**
 * a function to perform translation to I18_NAMESPACE namespace
 * @param value string to translate
 * @param options (optional) options for traslations
 */
export const t = (value: string, options?: TOptions): string => getI18n().t(value, { ns: I18N_NAMESPACE, ...options });
