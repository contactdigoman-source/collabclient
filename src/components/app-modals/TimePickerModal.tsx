import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import moment from 'moment';

import AppText from '../app-texts/AppText';
import { AppButton } from '../app-buttons/AppButton';
import { hp, wp, FontTypes } from '../../constants';

interface TimePickerModalProps {
  visible: boolean;
  onConfirm: (time: number) => void;
  onCancel: () => void;
  initialTime?: number;
  minTime?: number;
  maxTime?: number;
  title?: string;
  message?: string;
}

/**
 * TimePickerModal Component
 * 
 * A reusable modal for selecting a specific time
 * Used for manual checkout time correction
 * 
 * Features:
 * - Cross-platform time picker (iOS and Android)
 * - Optional min/max time constraints
 * - Customizable title and message
 */
export const TimePickerModal: React.FC<TimePickerModalProps> = ({
  visible,
  onConfirm,
  onCancel,
  initialTime,
  minTime,
  maxTime,
  title = 'Select Checkout Time',
  message = 'Choose the time when you actually checked out',
}) => {
  const { colors } = useTheme();
  
  // Initialize with initial time or current time
  const [selectedTime, setSelectedTime] = useState<Date>(
    initialTime ? new Date(initialTime) : new Date()
  );
  
  const [showPicker, setShowPicker] = useState<boolean>(Platform.OS === 'ios');

  const handleTimeChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    
    if (event.type === 'set' && date) {
      // Apply constraints if provided
      let constrainedDate = date;
      
      if (minTime && date.getTime() < minTime) {
        constrainedDate = new Date(minTime);
      }
      
      if (maxTime && date.getTime() > maxTime) {
        constrainedDate = new Date(maxTime);
      }
      
      setSelectedTime(constrainedDate);
    } else if (event.type === 'dismissed') {
      onCancel();
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedTime.getTime());
  };

  const handleShowPicker = () => {
    setShowPicker(true);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
          {/* Title */}
          <AppText
            size={hp(2.5)}
            fontType={FontTypes.medium}
            color={colors.text}
            style={styles.title}
          >
            {title}
          </AppText>

          {/* Message */}
          <AppText
            size={hp(1.8)}
            color={colors.text}
            style={styles.message}
          >
            {message}
          </AppText>

          {/* Time Display (Android) or Picker (iOS) */}
          {Platform.OS === 'android' && !showPicker && (
            <TouchableOpacity
              style={[styles.timeDisplay, { borderColor: colors.border }]}
              onPress={handleShowPicker}
            >
              <AppText size={hp(2.2)} color={colors.text} fontType={FontTypes.medium}>
                {moment(selectedTime).format('h:mm A')}
              </AppText>
              <AppText size={hp(1.5)} color={colors.text} style={styles.tapToChange}>
                Tap to change
              </AppText>
            </TouchableOpacity>
          )}

          {/* Time Picker */}
          {(Platform.OS === 'ios' || showPicker) && (
            <View style={styles.pickerContainer}>
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleTimeChange}
                minimumDate={minTime ? new Date(minTime) : undefined}
                maximumDate={maxTime ? new Date(maxTime) : undefined}
              />
            </View>
          )}

          {/* Time Constraints Info */}
          {(minTime || maxTime) && (
            <View style={styles.constraintsInfo}>
              {minTime && (
                <AppText size={hp(1.5)} color={colors.text} style={styles.constraintText}>
                  Earliest: {moment(minTime).format('h:mm A')}
                </AppText>
              )}
              {maxTime && (
                <AppText size={hp(1.5)} color={colors.text} style={styles.constraintText}>
                  Latest: {moment(maxTime).format('h:mm A')}
                </AppText>
              )}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <View style={styles.buttonWrapper}>
              <AppButton
                title="Cancel"
                onPress={onCancel}
                variant="outlined"
                size="medium"
              />
            </View>
            <View style={styles.buttonWrapper}>
              <AppButton
                title="Confirm"
                onPress={handleConfirm}
                variant="filled"
                size="medium"
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp(5),
  },
  modalContainer: {
    width: '100%',
    maxWidth: wp(90),
    borderRadius: 12,
    padding: wp(5),
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  title: {
    textAlign: 'center',
    marginBottom: hp(1),
  },
  message: {
    textAlign: 'center',
    marginBottom: hp(3),
    opacity: 0.7,
  },
  timeDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: hp(2),
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: hp(2),
  },
  tapToChange: {
    marginTop: hp(0.5),
    opacity: 0.6,
  },
  pickerContainer: {
    alignItems: 'center',
    marginBottom: hp(2),
  },
  constraintsInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: hp(2),
    paddingHorizontal: wp(2),
  },
  constraintText: {
    opacity: 0.6,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: hp(2),
    gap: wp(3),
  },
  buttonWrapper: {
    flex: 1,
  },
});

export default TimePickerModal;

