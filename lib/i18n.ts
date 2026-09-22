import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import id from '../locales/id';
import en from '../locales/en';

export const LANGUAGE_STORAGE_KEY = '@edumate_language';

const resources = {
  id: { translation: id },
  en: { translation: en },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'id', // default sebelum dicek AsyncStorage
  fallbackLng: 'id',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

// Muat bahasa yang tersimpan (kalau user pernah ganti sebelumnya)
AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then((savedLang) => {
  if (savedLang && (savedLang === 'id' || savedLang === 'en')) {
    i18n.changeLanguage(savedLang);
  }
});

export async function setAppLanguage(lang: 'id' | 'en') {
  await i18n.changeLanguage(lang);
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
}

export default i18n;