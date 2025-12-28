/**
 * FORGOT CHECKOUT MODAL
 * 
 * Modal shown when user has missed checkout (forgot to check out at end of shift)
 * Provides THREE options:
 * 1. "Check Out Now" - Normal checkout at current time (no approval)
 * 2. "Select Checkout Time" - Opens time picker for manual time selection (requires approval)
 * 3. "Forgot to Check Out" - Auto-checkout at shift end time, mark for approval (YELLOW status)
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import AppText from '../app-texts/AppText';
import { TimePickerModal } from './TimePickerModal';
import { hp, wp, FontTypes } from '../../constants';
import { APP_THEMES, DarkThemeColors, LightThemeColors } from '../../themes';
import { useAppSelector } from '../../redux';

interface ForgotCheckoutModalProps {
  visible: boolean;
  onCheckoutNow: () => void; // Option 1: User wants to checkout now (current time, no approval)
  onManualTime: (time: number) => void; // Option 2: User selects manual time (requires approval)
  onForgotCheckout: () => void; // Option 3: User confirms they forgot (shift end time, requires approval)
  onCancel: () => void; // Close modal without action
  shiftEndTime?: string; // Shift end time for constraints (e.g., "18:00")
}

export const ForgotCheckoutModal: React.FC<ForgotCheckoutModalProps> = ({
  visible,
  onCheckoutNow,
  onManualTime,
  onForgotCheckout,
  onCancel,
  shiftEndTime,
}) => {
  const { colors } = useTheme();
  const { appTheme } = useAppSelector(state => state.appState);
  const isDark = appTheme === APP_THEMES.dark;
  
  // State for time picker modal
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleManualTimeSelect = () => {
    setShowTimePicker(true);
  };

  const handleTimeConfirm = (selectedTime: number) => {
    setShowTimePicker(false);
    onManualTime(selectedTime);
  };

  const handleTimeCancel = () => {
    setShowTimePicker(false);
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onCancel}
        statusBarTranslucent={true}
      >
        <View style={styles.overlay}>
          <View
            style={[
              styles.modalContainer,
              {
                backgroundColor: isDark
                  ? DarkThemeColors.black
                  : LightThemeColors.white_common,
              },
            ]}
          >
            {/* Title */}
            <AppText
              size={hp(2.8)}
              fontType={FontTypes.medium}
              color={colors.text}
              style={styles.title}
            >
              Missed Checkout?
            </AppText>

            {/* Message */}
            <AppText
              size={hp(2)}
              color={colors.text}
              style={[styles.message, { opacity: 0.8 }]}
            >
              It appears you didn't check out at the end of your shift. Please choose an option:
            </AppText>

            {/* Divider */}
            <View
              style={[
                styles.divider,
                {
                  backgroundColor: isDark
                    ? DarkThemeColors.white_common + '20'
                    : LightThemeColors.black_common + '10',
                },
              ]}
            />

            {/* Options */}
            <AppText
              size={hp(1.9)}
              color={colors.text}
              style={[styles.optionsLabel, { opacity: 0.7 }]}
            >
              What would you like to do?
            </AppText>

            {/* Button 1: Check Out Now (No Approval) */}
            <TouchableOpacity
              style={[
                styles.button,
                styles.primaryButton,
                { backgroundColor: '#62c268' }, // Green for no approval
              ]}
              onPress={onCheckoutNow}
              activeOpacity={0.8}
            >
              <AppText
                size={hp(2.2)}
                fontType={FontTypes.medium}
                color={DarkThemeColors.white_common}
              >
                Check Out Now
              </AppText>
              <AppText
                size={hp(1.6)}
                color={DarkThemeColors.white_common}
                style={[styles.buttonSubtext, { opacity: 0.9 }]}
              >
                Use current time (no approval needed)
              </AppText>
            </TouchableOpacity>

            {/* Button 2: Select Checkout Time (Requires Approval) */}
            <TouchableOpacity
              style={[
                styles.button,
                styles.secondaryButton,
                {
                  backgroundColor: isDark
                    ? DarkThemeColors.white_common + '15'
                    : LightThemeColors.black_common + '08',
                  borderColor: '#FFA500',
                  borderWidth: 1.5,
                },
              ]}
              onPress={handleManualTimeSelect}
              activeOpacity={0.8}
            >
              <AppText
                size={hp(2.2)}
                fontType={FontTypes.medium}
                color={colors.text}
              >
                Select Checkout Time
              </AppText>
              <AppText
                size={hp(1.6)}
                color={colors.text}
                style={[styles.buttonSubtext, { opacity: 0.6 }]}
              >
                Pick specific time (requires approval)
              </AppText>
            </TouchableOpacity>

            {/* Button 3: Forgot to Check Out (Requires Approval) */}
            <TouchableOpacity
              style={[
                styles.button,
                styles.secondaryButton,
                {
                  backgroundColor: isDark
                    ? DarkThemeColors.white_common + '15'
                    : LightThemeColors.black_common + '08',
                  borderColor: isDark
                    ? DarkThemeColors.white_common + '30'
                    : LightThemeColors.black_common + '20',
                },
              ]}
              onPress={onForgotCheckout}
              activeOpacity={0.8}
            >
              <AppText
                size={hp(2.2)}
                fontType={FontTypes.medium}
                color={colors.text}
              >
                Forgot to Check Out
              </AppText>
              <AppText
                size={hp(1.6)}
                color={colors.text}
                style={[styles.buttonSubtext, { opacity: 0.6 }]}
              >
                No time recorded (requires approval)
              </AppText>
            </TouchableOpacity>

            {/* Cancel button */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <AppText
                size={hp(1.9)}
                color={colors.text}
                style={{ opacity: 0.6 }}
              >
                Cancel
              </AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      <TimePickerModal
        visible={showTimePicker}
        onConfirm={handleTimeConfirm}
        onCancel={handleTimeCancel}
        title="Select Checkout Time"
        message="Choose the time when you actually checked out"
        maxTime={Date.now()} // Can't select future time
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp(5),
  },
  modalContainer: {
    width: '100%',
    maxWidth: wp(90),
    borderRadius: wp(4),
    paddingVertical: hp(3),
    paddingHorizontal: wp(5),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  title: {
    textAlign: 'center',
    marginBottom: hp(1.5),
  },
  message: {
    textAlign: 'center',
    lineHeight: hp(2.8),
    marginBottom: hp(2),
  },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: hp(2),
  },
  optionsLabel: {
    textAlign: 'center',
    marginBottom: hp(2),
  },
  button: {
    width: '100%',
    paddingVertical: hp(2),
    paddingHorizontal: wp(4),
    borderRadius: wp(2.5),
    marginBottom: hp(1.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  secondaryButton: {
    borderWidth: 1,
  },
  buttonSubtext: {
    marginTop: hp(0.5),
  },
  cancelButton: {
    marginTop: hp(1),
    paddingVertical: hp(1.5),
    alignItems: 'center',
  },
});

