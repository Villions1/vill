import { useSettingsStore } from '../store';
import { t as translate, type TranslationKey, type Locale } from './translations';

export function useI18n() {
  const language = useSettingsStore((s) => s.settings.language) as Locale || 'en';

  const t = (key: TranslationKey): string => {
    return translate(key, language);
  };

  return { t, locale: language };
}
