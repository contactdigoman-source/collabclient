# Internationalization (i18n) Setup

This app now supports multiple languages: English (en), Spanish (es), Hindi (hi), and Bengali (bn).

## Installation

Install the required dependencies:

```bash
npm install i18next react-i18next react-native-localize
# or
yarn add i18next react-i18next react-native-localize
```

## Usage

### In Components

Import and use the translation hook:

```typescript
import { useTranslation } from '../../hooks/useTranslation';

function MyComponent() {
  const { t } = useTranslation();
  
  return <Text>{t('auth.login.title')}</Text>;
}
```

### Changing Language

```typescript
import { useTranslation } from '../../hooks/useTranslation';

function LanguageSwitcher() {
  const { changeLanguage, currentLanguage } = useTranslation();
  
  return (
    <Button onPress={() => changeLanguage('es')}>
      Switch to Spanish
    </Button>
  );
}
```

## Translation Files

Translation files are located in `src/i18n/locales/`:
- `en.json` - English
- `es.json` - Spanish
- `hi.json` - Hindi
- `bn.json` - Bengali

## Adding New Translations

1. Add the key-value pair to all language files in `src/i18n/locales/`
2. Use the key in your component: `t('your.key.path')`

## Language Detection

The app automatically detects the device language on first launch and uses it if supported. Otherwise, it defaults to English.

The selected language is saved and persists across app restarts.

