import React, { useMemo } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { AppText } from '..';
import { hp, wp } from '../../constants';
import { useTranslation } from '../../hooks/useTranslation';
import { changeLanguage } from '../../i18n';

interface LanguageOption {
  code: string;
  label: string;
  nativeName: string;
}

interface LanguagePickerModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function LanguagePickerModal({
  visible,
  onClose,
}: LanguagePickerModalProps): React.JSX.Element {
  const { t, currentLanguage } = useTranslation();
  const { colors } = useTheme();

  const languageOptions: LanguageOption[] = useMemo(() => [
    { code: 'en', label: t('profile.language.english', 'English'), nativeName: 'English' },
    { code: 'es', label: t('profile.language.spanish', 'Spanish'), nativeName: 'Español' },
    { code: 'hi', label: t('profile.language.hindi', 'Hindi'), nativeName: 'हिन्दी' },
    { code: 'bn', label: t('profile.language.bengali', 'Bengali'), nativeName: 'বাংলা' },
  ], [t]);

  const handleLanguageSelect = (languageCode: string): void => {
    if (languageCode !== currentLanguage) {
      changeLanguage(languageCode);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
            {/* Header with title */}
            <View style={styles.header}>
              <AppText
                size={hp(2.25)}
                style={styles.title}
                color={colors.text}
              >
                {t('profile.language.selectLanguage', 'Select Language')}
              </AppText>
            </View>

            {/* Language options */}
            <View style={styles.optionsContainer}>
              {languageOptions.map((option) => {
                const isSelected = option.code === currentLanguage;
                return (
                  <TouchableOpacity
                    key={option.code}
                    style={[
                      styles.optionItem,
                      isSelected && { backgroundColor: colors.primary + '20' },
                    ]}
                    onPress={() => handleLanguageSelect(option.code)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionContent}>
                      <AppText
                        size={hp(2.25)}
                        style={styles.optionLabel}
                        color={colors.text}
                      >
                        {option.label}
                      </AppText>
                      <AppText
                        size={hp(1.8)}
                        style={styles.optionNativeName}
                        color={colors.text + '80'}
                      >
                        {option.nativeName}
                      </AppText>
                    </View>
                    {isSelected && (
                      <View style={[styles.checkmark, { backgroundColor: colors.primary }]}>
                        <AppText size={hp(1.5)} color="#FFFFFF">✓</AppText>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    width: wp(100.56),
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    paddingTop: hp(2.2),
    paddingHorizontal: wp(7.95),
    paddingBottom: hp(3),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(2.5),
  },
  title: {
    fontFamily: 'Noto Sans',
    fontWeight: '500',
    lineHeight: hp(2.6),
  },
  optionsContainer: {
    gap: hp(1.5),
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: hp(1.5),
    paddingHorizontal: wp(4),
    borderRadius: 8,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    lineHeight: hp(2.6),
    marginBottom: hp(0.3),
  },
  optionNativeName: {
    fontFamily: 'Noto Sans',
    fontWeight: '400',
    lineHeight: hp(2.2),
  },
  checkmark: {
    width: hp(2.5),
    height: hp(2.5),
    borderRadius: hp(1.25),
    justifyContent: 'center',
    alignItems: 'center',
  },
});

