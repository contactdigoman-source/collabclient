import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, Image, Modal } from 'react-native';
import { useTheme } from '@react-navigation/native';
import ImagePicker, { ImageOrVideo } from 'react-native-image-crop-picker';

import {
  AppContainer,
  AppInput,
  AppText,
  BackHeader,
  UserImage,
} from '../../components';
import { useAppSelector } from '../../redux';
import { hp, wp, Icons, FontTypes } from '../../constants';
import { DarkThemeColors, APP_THEMES } from '../../themes';
import { useTranslation } from '../../hooks/useTranslation';
import { getProfile, updateProfile, uploadProfilePhoto } from '../../services';
import { profileSyncService } from '../../services/sync/profile-sync-service';

const DEFAULT_VALUE = 'None';

export default function ViewProfileScreen(): React.JSX.Element {
  const theme = useTheme();
  const colors = useMemo(() => (theme?.colors || {}) as any, [theme?.colors]);
  const { appTheme } = useAppSelector(state => state.appState);
  const { t } = useTranslation();
  const { userData } = useAppSelector(state => state.userState);

  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  
  // Editable fields
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState<string>(''); // Store as YYYY-MM-DD string
  const [employmentType, setEmploymentType] = useState<string>('');
  const [designation, setDesignation] = useState<string>('');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  // Load profile data on mount
  useEffect(() => {
    const loadProfile = async () => {
      if (!userData?.email) return;

      try {
        // First, call getProfile() which will merge server and local data into DB
        // getProfile() only overwrites local if server.lastSyncedAt >= local.lastUpdatedAt
        await getProfile();
        
        // Then load from DB (which now has the latest merged data)
        const dbProfile = await profileSyncService.loadProfileFromDB(userData.email);
        
        if (dbProfile) {
          // Load all data from DB
          setFirstName(dbProfile.firstName || '');
          setLastName(dbProfile.lastName || '');
          setEmploymentType(dbProfile.employmentType || '');
          setDesignation(dbProfile.designation || '');
          setProfilePhoto(dbProfile.profilePhotoUrl || null);
          
          // Parse date of birth to YYYY-MM-DD format
          if (dbProfile.dateOfBirth) {
            try {
              const date = new Date(dbProfile.dateOfBirth);
              if (!isNaN(date.getTime())) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                setDateOfBirth(`${year}-${month}-${day}`);
              } else {
                setDateOfBirth('');
              }
            } catch {
              setDateOfBirth('');
            }
          } else {
            setDateOfBirth('');
          }
        } else {
          // Fallback to Redux if DB is empty
          setFirstName(userData?.firstName || '');
          setLastName(userData?.lastName || '');
          setEmploymentType(userData?.employmentType || '');
          setDesignation(userData?.designation || '');
          setProfilePhoto(userData?.profilePhotoUrl || userData?.profilePhoto || null);
          
          if (userData?.dateOfBirth) {
            try {
              const date = new Date(userData.dateOfBirth);
              if (!isNaN(date.getTime())) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                setDateOfBirth(`${year}-${month}-${day}`);
              } else {
                setDateOfBirth('');
              }
            } catch {
              setDateOfBirth('');
            }
          } else {
            setDateOfBirth('');
          }
        }
      } catch (error: any) {
        // Silently fail - app should work even if profile service is down
        // Use Redux data as fallback
        console.warn('[ViewProfile] Failed to load profile (service may be down):', error.message);
        if (userData) {
          setFirstName(userData.firstName || '');
          setLastName(userData.lastName || '');
          setEmploymentType(userData.employmentType || '');
          setDesignation(userData.designation || '');
          setProfilePhoto(userData.profilePhotoUrl || userData.profilePhoto || null);
          
          if (userData.dateOfBirth) {
            try {
              const date = new Date(userData.dateOfBirth);
              if (!isNaN(date.getTime())) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                setDateOfBirth(`${year}-${month}-${day}`);
              } else {
                setDateOfBirth('');
              }
            } catch {
              setDateOfBirth('');
            }
          } else {
            setDateOfBirth('');
          }
        }
      }
    };

    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.email]);

  // Memoize dynamic styles
  const dateInputStyle = useMemo(() => ({
    backgroundColor: (colors as any).cardBg || DarkThemeColors.black + '20',
    borderColor: appTheme === APP_THEMES.light 
      ? (colors as any).cardBorder || '#E0E0E0'
      : DarkThemeColors.white_common + '40',
    shadowColor: appTheme === APP_THEMES.light ? (colors as any).black_common || '#000000' : 'transparent',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: appTheme === APP_THEMES.light ? 0.05 : 0,
    shadowRadius: appTheme === APP_THEMES.light ? 2 : 0,
    elevation: appTheme === APP_THEMES.light ? 1 : 0,
  }), [appTheme, colors]);

  const cancelModalButtonStyle = useMemo(() => ({
    backgroundColor: appTheme === APP_THEMES.light 
      ? (colors as any).cardBg || '#F6F6F6'
      : DarkThemeColors.white_common + '20',
    borderWidth: appTheme === APP_THEMES.light ? 1 : 0,
    borderColor: appTheme === APP_THEMES.light ? (colors as any).cardBorder || '#E0E0E0' : 'transparent',
  }), [appTheme, colors]);

  // Update local state when userData changes
  useEffect(() => {
    if (userData && !isEditMode) {
      setFirstName(userData.firstName || '');
      setLastName(userData.lastName || '');
      setEmploymentType(userData.employmentType || '');
      setDesignation(userData.designation || '');
      // Use profilePhotoUrl if available, otherwise fallback to profilePhoto
      setProfilePhoto(userData.profilePhotoUrl || userData.profilePhoto || null);
      
      if (userData.dateOfBirth) {
        try {
          const date = new Date(userData.dateOfBirth);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            setDateOfBirth(`${year}-${month}-${day}`);
          } else {
            setDateOfBirth('');
          }
        } catch {
          setDateOfBirth('');
        }
      } else {
        setDateOfBirth('');
      }
    }
  }, [userData, isEditMode]);

  const handleEditPhoto = useCallback(() => {
    if (!isEditMode) return;

    Alert.alert(
      t('auth.profilePhoto.title'),
      t('auth.profilePhoto.subtitle'),
      [
        {
          text: t('auth.profilePhoto.takePhoto'),
          onPress: () => {
            ImagePicker.openCamera({
              width: 300,
              height: 300,
              cropping: true,
              mediaType: 'photo',
            })
              .then((image: ImageOrVideo) => {
                setProfilePhoto(image.path);
              })
              .catch((e: any) => {
                if (e.code !== 'E_PICKER_CANCELLED') {
                  Alert.alert(t('common.error'), e.message);
                }
              });
          },
        },
        {
          text: t('auth.profilePhoto.chooseFromGallery'),
          onPress: () => {
            ImagePicker.openPicker({
              width: 300,
              height: 300,
              cropping: true,
              mediaType: 'photo',
            })
              .then((image: ImageOrVideo) => {
                setProfilePhoto(image.path);
              })
              .catch((e: any) => {
                if (e.code !== 'E_PICKER_CANCELLED') {
                  Alert.alert(t('common.error'), e.message);
                }
              });
          },
        },
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
      ],
    );
  }, [isEditMode, t]);

  const handleDatePickerOpen = useCallback(() => {
    if (!isEditMode) return;
    // Initialize tempDate with current dateOfBirth or today
    if (dateOfBirth) {
      try {
        const date = new Date(dateOfBirth);
        if (!isNaN(date.getTime())) {
          setTempDate(date);
        }
      } catch {
        setTempDate(new Date());
      }
    } else {
      setTempDate(new Date());
    }
    setShowDatePicker(true);
  }, [isEditMode, dateOfBirth]);

  const handleDatePickerConfirm = useCallback(() => {
    const year = tempDate.getFullYear();
    const month = String(tempDate.getMonth() + 1).padStart(2, '0');
    const day = String(tempDate.getDate()).padStart(2, '0');
    setDateOfBirth(`${year}-${month}-${day}`);
    setShowDatePicker(false);
  }, [tempDate]);

  const handleDatePickerCancel = useCallback(() => {
    setShowDatePicker(false);
  }, []);

  const changeDate = useCallback((type: 'year' | 'month' | 'day', delta: number) => {
    setTempDate(prev => {
      const newDate = new Date(prev);
      if (type === 'year') {
        newDate.setFullYear(prev.getFullYear() + delta);
      } else if (type === 'month') {
        newDate.setMonth(prev.getMonth() + delta);
      } else if (type === 'day') {
        newDate.setDate(prev.getDate() + delta);
      }
      return newDate;
    });
  }, []);


  const handleSave = useCallback(async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert(t('common.error'), t('auth.firstTimeLogin.firstNameRequired', 'First name and last name are required'));
      return;
    }

    try {
      setIsLoading(true);

      let photoUrl: string | undefined;

      // Upload photo first if changed (local file path)
      if (profilePhoto && (profilePhoto.startsWith('/') || profilePhoto.startsWith('file://'))) {
        try {
          const uploadResponse = await uploadProfilePhoto(profilePhoto);
          if (uploadResponse.success && uploadResponse.profilePhotoUrl) {
            photoUrl = uploadResponse.profilePhotoUrl;
            // // Update local state immediately with the server URL so it shows right away
            // setProfilePhoto(photoUrl);
            // // Also update Redux is already done in uploadProfilePhoto, but ensure it's reflected
          } else {
            throw new Error('Photo upload succeeded but no URL returned');
          }
        } catch (error: any) {
          console.error('Failed to upload photo:', error.message);
          Alert.alert(t('common.error'), `Failed to upload photo: ${error.message}`);
          return; // Don't continue if photo upload fails
        }
      } else if (profilePhoto && (profilePhoto.startsWith('http://') || profilePhoto.startsWith('https://'))) {
        // Already a URL, use it directly
        photoUrl = profilePhoto;
      }

      // Validate date of birth format (YYYY-MM-DD)
      let dobISO: string | undefined;
      if (dateOfBirth.trim()) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (dateRegex.test(dateOfBirth.trim())) {
          // Validate it's a valid date
          const date = new Date(dateOfBirth.trim());
          if (!isNaN(date.getTime())) {
            dobISO = dateOfBirth.trim();
          } else {
            Alert.alert(t('common.error'), 'Invalid date format. Please use YYYY-MM-DD');
            return;
          }
        } else {
          Alert.alert(t('common.error'), 'Invalid date format. Please use YYYY-MM-DD');
          return;
        }
      }

      // Update profile with photo URL (if uploaded)
      await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: dobISO,
        employmentType: employmentType.trim() || undefined,
        designation: designation.trim() || undefined,
        profilePhotoUrl: photoUrl, // Include photo URL from upload
      });

      // Call getProfile() to refresh DB from server (only overwrites if server.lastSyncedAt >= local.lastUpdatedAt)
      // This ensures DB has the latest merged data from server
      await getProfile();

      // Reload profile data from DB (which now has the latest merged data from getProfile)
      if (userData?.email) {
        try {
          const dbProfile = await profileSyncService.loadProfileFromDB(userData.email);
          if (dbProfile) {
            // Reload all fields from DB
            setFirstName(dbProfile.firstName || '');
            setLastName(dbProfile.lastName || '');
            setEmploymentType(dbProfile.employmentType || '');
            setDesignation(dbProfile.designation || '');
            setProfilePhoto(dbProfile.profilePhotoUrl || null);
            
            // Parse date of birth
            if (dbProfile.dateOfBirth) {
              try {
                const date = new Date(dbProfile.dateOfBirth);
                if (!isNaN(date.getTime())) {
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  setDateOfBirth(`${year}-${month}-${day}`);
                } else {
                  setDateOfBirth('');
                }
              } catch {
                setDateOfBirth('');
              }
            } else {
              setDateOfBirth('');
            }
          }
        } catch (error) {
          console.log('Error reloading profile from DB after update:', error);
          // Continue even if reload fails
        }
      }

      Alert.alert(t('common.success'), t('common.save', 'Profile updated successfully'));
      setIsEditMode(false);
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  }, [firstName, lastName, dateOfBirth, employmentType, designation, profilePhoto, t, userData?.email]);

  const handleCancel = useCallback(() => {
    // Reset to original values
    if (userData) {
      setFirstName(userData.firstName || '');
      setLastName(userData.lastName || '');
      setEmploymentType(userData.employmentType || '');
      setProfilePhoto(userData.profilePhoto || null);
      
      if (userData.dateOfBirth) {
        try {
          const date = new Date(userData.dateOfBirth);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            setDateOfBirth(`${year}-${month}-${day}`);
          } else {
            setDateOfBirth('');
          }
        } catch {
          setDateOfBirth('');
        }
      } else {
        setDateOfBirth('');
      }
    }
    setIsEditMode(false);
  }, [userData]);

  const PROFILE_ITEMS = {
    firstName: t('profile.firstName'),
    lastName: t('profile.lastName'),
    email: t('profile.email'),
    doa: t('profile.dateOfActivation'),
    dob: t('profile.dateOfBirth'),
    empId: t('profile.empId'),
    empType: t('profile.employmentType'),
    designation: t('profile.designation'),
  };

  // Format date from ISO string
  const formatDate = (dateString?: string): string => {
    if (!dateString) return DEFAULT_VALUE;
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return DEFAULT_VALUE;
      return date.toLocaleDateString();
    } catch {
      return DEFAULT_VALUE;
    }
  };

  return (
    <AppContainer>
      <BackHeader 
        title={t('profile.profileDetails')} 
        isTitleVisible={true}
        rightContent={
          !isEditMode ? (
            <TouchableOpacity onPress={() => setIsEditMode(true)}>
              <Image
                source={Icons.edit}
                style={[styles.editIcon, { tintColor: colors.text || DarkThemeColors.white_common }]}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.editActions}>
              <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
                <AppText size={hp(1.8)} color={colors.text || DarkThemeColors.white_common}>
                  {t('common.cancel')}
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={isLoading}>
                <AppText size={hp(1.8)} color={DarkThemeColors.white_common}>
                  {t('common.save')}
                </AppText>
              </TouchableOpacity>
            </View>
          )
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {/* Profile Photo */}
        <View style={styles.photoContainer}>
          <UserImage
            size={hp(15)}
            source={profilePhoto ? { uri: profilePhoto } : null}
            userName={profilePhoto ? undefined : `${firstName || ''} ${lastName || ''}`.trim() || 'User'}
            isAttendanceStatusVisible={false}
            charsCount={2}
          />
          {isEditMode && (
            <TouchableOpacity
              style={[styles.editPhotoButton, { backgroundColor: colors.primary || DarkThemeColors.primary }]}
              onPress={handleEditPhoto}
            >
              <Image
                source={Icons.edit}
                style={[styles.editPhotoIcon, { tintColor: colors.text || DarkThemeColors.white_common }]}
              />
            </TouchableOpacity>
          )}
        </View>

        <AppInput
          value={firstName}
          editable={isEditMode}
          placeholder={PROFILE_ITEMS.firstName}
          label={PROFILE_ITEMS.firstName}
          onChangeText={setFirstName}
        />
        <AppInput
          value={lastName}
          editable={isEditMode}
          placeholder={PROFILE_ITEMS.lastName}
          label={PROFILE_ITEMS.lastName}
          onChangeText={setLastName}
        />
        <AppInput
          value={userData?.email || DEFAULT_VALUE}
          editable={false}
          placeholder={PROFILE_ITEMS.email}
          label={PROFILE_ITEMS.email}
        />
        <AppInput
          value={formatDate(userData?.dateOfActivation)}
          editable={false}
          placeholder={PROFILE_ITEMS.doa}
          label={PROFILE_ITEMS.doa}
        />
        
        {/* Date of Birth - Editable with Calendar Picker */}
        {isEditMode ? (
          <View>
            <AppText size={hp(1.8)} style={styles.label}>
              {PROFILE_ITEMS.dob}
            </AppText>
            <TouchableOpacity
              onPress={handleDatePickerOpen}
              style={[
                styles.dateInputContainer,
                dateInputStyle,
              ]}
            >
              <AppText size={hp(2)} color={dateOfBirth ? colors.text || DarkThemeColors.white_common : (colors.text || DarkThemeColors.white_common) + '80'}>
                {dateOfBirth || PROFILE_ITEMS.dob}
              </AppText>
            </TouchableOpacity>
          </View>
        ) : (
          <AppInput
            value={formatDate(dateOfBirth || userData?.dateOfBirth)}
            editable={false}
            placeholder={PROFILE_ITEMS.dob}
            label={PROFILE_ITEMS.dob}
          />
        )}

        <AppInput
          value={userData?.empId || DEFAULT_VALUE}
          editable={false}
          placeholder={PROFILE_ITEMS.empId}
          label={PROFILE_ITEMS.empId}
        />
        
        {/* Employment Type - Editable */}
        <AppInput
          value={employmentType}
          editable={isEditMode}
          placeholder={PROFILE_ITEMS.empType}
          label={PROFILE_ITEMS.empType}
          onChangeText={setEmploymentType}
        />
        
        {/* Designation - Editable */}
        <AppInput
          value={designation}
          editable={isEditMode}
          placeholder={PROFILE_ITEMS.designation}
          label={PROFILE_ITEMS.designation}
          onChangeText={setDesignation}
        />
      </ScrollView>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={handleDatePickerCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.datePickerModal}>
            <AppText size={hp(2.5)} fontType={FontTypes.medium} color={colors.text || DarkThemeColors.white_common} style={styles.modalTitle}>
              {t('profile.dateOfBirth')}
            </AppText>
            
            <View style={styles.datePickerContainer}>
              <View style={styles.datePickerRow}>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => changeDate('year', -1)}
                >
                  <AppText size={hp(2)}>−</AppText>
                </TouchableOpacity>
                <View style={styles.datePickerValue}>
                  <AppText size={hp(2.5)} fontType={FontTypes.medium}>
                    {tempDate.getFullYear()}
                  </AppText>
                  <AppText size={hp(1.5)}>Year</AppText>
                </View>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => changeDate('year', 1)}
                >
                  <AppText size={hp(2)}>+</AppText>
                </TouchableOpacity>
              </View>

              <View style={styles.datePickerRow}>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => changeDate('month', -1)}
                >
                  <AppText size={hp(2)}>−</AppText>
                </TouchableOpacity>
                <View style={styles.datePickerValue}>
                  <AppText size={hp(2.5)} fontType={FontTypes.medium}>
                    {tempDate.toLocaleDateString('en-US', { month: 'long' })}
                  </AppText>
                  <AppText size={hp(1.5)}>Month</AppText>
                </View>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => changeDate('month', 1)}
                >
                  <AppText size={hp(2)}>+</AppText>
                </TouchableOpacity>
              </View>

              <View style={styles.datePickerRow}>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => changeDate('day', -1)}
                >
                  <AppText size={hp(2)}>−</AppText>
                </TouchableOpacity>
                <View style={styles.datePickerValue}>
                  <AppText size={hp(2.5)} fontType={FontTypes.medium}>
                    {tempDate.getDate()}
                  </AppText>
                  <AppText size={hp(1.5)}>Day</AppText>
                </View>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => changeDate('day', 1)}
                >
                  <AppText size={hp(2)}>+</AppText>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.cancelModalButton,
                  cancelModalButtonStyle,
                ]}
                onPress={handleDatePickerCancel}
              >
                <AppText size={hp(2)} color={colors.text || DarkThemeColors.white_common}>
                  {t('common.cancel')}
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmModalButton]}
                onPress={handleDatePickerConfirm}
              >
                <AppText size={hp(2)} color={colors.text || DarkThemeColors.white_common}>
                  {t('common.save')}
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: hp(2),
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: hp(3),
    position: 'relative',
  },
  editPhotoButton: {
    position: 'absolute',
    bottom: 0,
    right: wp(25),
    borderRadius: 20,
    padding: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  editPhotoIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  editIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    marginRight: wp(4),
  },
  editActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: wp(4),
  },
  cancelButton: {
    marginRight: wp(4),
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.5),
  },
  saveButton: {
    backgroundColor: DarkThemeColors.primary,
    paddingHorizontal: wp(4),
    paddingVertical: hp(0.8),
    borderRadius: 5,
  },
  label: {
    marginBottom: hp(1),
  },
  dateInputContainer: {
    borderWidth: 1,
    borderRadius: 8,
    padding: hp(1.5),
    marginBottom: hp(2),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerModal: {
    borderRadius: 12,
    padding: hp(3),
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: hp(3),
  },
  datePickerContainer: {
    marginVertical: hp(2),
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: hp(1.5),
    paddingVertical: hp(1),
    borderBottomWidth: 1,
  },
  datePickerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DarkThemeColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerValue: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: hp(2),
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: hp(3),
  },
  modalButton: {
    flex: 1,
    paddingVertical: hp(1.5),
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: hp(1),
  },
  cancelModalButton: {
  },
  confirmModalButton: {
    backgroundColor: DarkThemeColors.primary,
  },
});
