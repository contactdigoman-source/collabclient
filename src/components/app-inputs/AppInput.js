import React, { useState, useRef, memo } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { hp, Icons, wp } from '../../constants';
import { AppImage, AppText } from '../../components';
import { useTheme } from '@react-navigation/native';

function AppInput({
  inputContainerStyle,
  containerStyle,
  style,
  label,
  onChangeText,
  error,
  refName,
  rightContent,
  icon,
  isBorderFocused,
  placeholderTextColor,
  editable = true,
  iconStyle,
  errorStyle,
  iconTintColor,
  bgColor,
  keyboardType = 'default',
  secureTextEntry: secureTextProp,
  ...restProps
}) {
  const { colors } = useTheme();
  const inputRef = refName || useRef(null);

  const [secureTextEntry, setSecureTextEntry] = useState(!!secureTextProp);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <AppText
          size={hp('1.98%')}
          color={colors.app_input_label}
          style={styles.label}
        >
          {label}
        </AppText>
      )}

      <View
        style={[
          styles.inputContainer,
          inputContainerStyle,
          {
            borderColor: isBorderFocused ? colors.red : colors.black,
            borderWidth: isBorderFocused ? 2 : 0,
            backgroundColor: bgColor || colors.app_input_bg,
          },
        ]}
      >
        {icon && (
          <View style={[styles.iconContainer, iconStyle]}>
            <AppImage
              source={icon}
              size={wp('5.60%')}
              tintColor={iconTintColor || colors.white}
            />
          </View>
        )}

        <TextInput
          {...restProps}
          ref={inputRef}
          style={[styles.input, style, { color: colors.white }]}
          placeholderTextColor={
            placeholderTextColor || colors.app_input_placeholder
          }
          onChangeText={onChangeText}
          autoCorrect={false}
          editable={editable}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
        />

        {rightContent}

        {secureTextProp && (
          <AppImage
            size={wp('5.8%')}
            resizeMode="contain"
            source={secureTextEntry ? Icons.eye_closed : Icons.eye_opened}
            isClickable
            onPress={() => setSecureTextEntry(prev => !prev)}
          />
        )}
      </View>

      {error && (
        <AppText color={colors.red} style={errorStyle}>
          {error}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: hp('2.48%'),
  },
  label: {
    marginBottom: hp('1.24%'),
    marginStart: wp('0.76%'),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: hp('1.24%'),
    overflow: 'hidden',
    paddingEnd: wp('3.82%'),
  },
  input: {
    flex: 1,
    paddingVertical: hp(2.2),
    fontSize: hp('1.86%'),
    paddingStart: wp('4.07%'),
    fontFamily: 'NotoSans-Regular',
  },
  iconContainer: {
    marginStart: wp('4.58%'),
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default memo(AppInput);
