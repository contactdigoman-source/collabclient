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
import { useAppSelector, useAppDispatch, setUserData } from '../../redux';
import { hp, wp, Icons, FontTypes } from '../../constants';
import { DarkThemeColors, LightThemeColors, APP_THEMES } from '../../themes';
import { useTranslation } from '../../hooks/useTranslation';
import { getProfile, updateProfile } from '../../services';
import { profileSyncService } from '../../services/sync/profile-sync-service';
import { logger } from '../../services/logger';

// DEFAULT_VALUE will use translation

export default function ViewProfileScreen(): React.JSX.Element {
  const theme = useTheme();
  const colors = useMemo(() => (theme?.colors || {}) as any, [theme?.colors]);
  const { appTheme } = useAppSelector(state => state.appState);
  const { t } = useTranslation();
  const { userData } = useAppSelector(state => state.userState);
  const dispatch = useAppDispatch();

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
        logger.warn('[ViewProfile] Failed to load profile (service may be down)', error);
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
    logger.debug('[ViewProfile] handleEditPhoto called', { isEditMode });
    if (!isEditMode) {
      logger.warn('[ViewProfile] handleEditPhoto called but not in edit mode');
      return;
    }

    logger.debug('[ViewProfile] Showing photo picker alert');
    Alert.alert(
      t('auth.profilePhoto.title', 'Select Photo'),
      t('auth.profilePhoto.subtitle', 'Choose an option'),
      [
        {
          text: t('auth.profilePhoto.takePhoto', 'Take Photo'),
          onPress: () => {
            logger.debug('[ViewProfile] User selected take photo');
            ImagePicker.openCamera({
              mediaType: 'photo',
              cropping: true,
              cropperCircleOverlay: true,
              cropperChooseText: t('common.save', 'Save'),
              cropperCancelText: t('common.cancel', 'Cancel'),
              cropperToolbarTitle: t('auth.profilePhoto.cropPhoto', 'Crop Photo'),
              cropperActiveWidgetColor: colors.primary || DarkThemeColors.primary,
              width: 1000,
              height: 1000,
              avoidEmptySpaceAroundImage: true, // Enable to fill the circle properly
              compressImageQuality: 0.9, // Higher quality
              cropperRotateButtonsHidden: true,
              freeStyleCropEnabled: false, // Disable free-style to lock to circle
              forceJpg: true, // Ensure consistent format
            })
              .then(async (image: ImageOrVideo) => {
                logger.debug('[ViewProfile] Photo captured successfully', { path: image.path });
                setProfilePhoto(image.path);
                
                // Immediately update Redux with local file path for instant display
                if (userData?.email) {
                  try {
                    const now = Date.now();
                    // Update lastUpdatedAt first, then save profile photo
                    await profileSyncService.updateLastUpdatedAt(userData.email, now);
                    // Save local path to DB with current timestamp
                    await profileSyncService.saveProfileProperty(userData.email, 'profilePhoto', image.path);
                    
                    // Update Redux immediately with local path
                    dispatch(setUserData({
                      ...userData,
                      profilePhoto: image.path,
                      profilePhotoUrl: image.path, // Use local path until server URL is synced
                    }));
                    logger.debug('[ViewProfile] Updated Redux with local photo path', { path: image.path });
                  } catch (error: any) {
                    logger.error('[ViewProfile] Error saving local photo path to DB', error);
                    // Still update Redux even if DB save fails
                    dispatch(setUserData({
                      ...userData,
                      profilePhoto: image.path,
                      profilePhotoUrl: image.path,
                    }));
                  }
                }
              })
              .catch((e: any) => {
                logger.error('[ViewProfile] Error capturing photo', e);
                if (e.code !== 'E_PICKER_CANCELLED') {
                  Alert.alert(t('common.error', 'Error'), e.message || 'Failed to capture photo');
                }
              });
          },
        },
        {
          text: t('auth.profilePhoto.chooseFromGallery', 'Choose from Gallery'),
          onPress: () => {
            logger.debug('[ViewProfile] User selected choose from gallery');
            ImagePicker.openPicker({
              mediaType: 'photo',
              cropping: true,
              cropperCircleOverlay: true,
              cropperChooseText: t('common.save', 'Save'),
              cropperCancelText: t('common.cancel', 'Cancel'),
              cropperToolbarTitle: t('auth.profilePhoto.cropPhoto', 'Crop Photo'),
              cropperActiveWidgetColor: colors.primary || DarkThemeColors.primary,
              width: 1000,
              height: 1000,
              avoidEmptySpaceAroundImage: true, // Enable to fill the circle properly
              compressImageQuality: 0.9, // Higher quality
              cropperRotateButtonsHidden: true,
              freeStyleCropEnabled: false, // Disable free-style to lock to circle
              forceJpg: true, // Ensure consistent format
            })
              .then(async (image: ImageOrVideo) => {
                logger.debug('[ViewProfile] Photo selected successfully', { path: image.path });
                setProfilePhoto(image.path);
                
                // Immediately update Redux with local file path for instant display
                if (userData?.email) {
                  try {
                    const now = Date.now();
                    // Update lastUpdatedAt first, then save profile photo
                    await profileSyncService.updateLastUpdatedAt(userData.email, now);
                    // Save local path to DB with current timestamp
                    await profileSyncService.saveProfileProperty(userData.email, 'profilePhoto', image.path);
                    
                    // Update Redux immediately with local path
                    dispatch(setUserData({
                      ...userData,
                      profilePhoto: image.path,
                      profilePhotoUrl: image.path, // Use local path until server URL is synced
                    }));
                    logger.debug('[ViewProfile] Updated Redux with local photo path', { path: image.path });
                  } catch (error: any) {
                    logger.error('[ViewProfile] Error saving local photo path to DB', error);
                    // Still update Redux even if DB save fails
                    dispatch(setUserData({
                      ...userData,
                      profilePhoto: image.path,
                      profilePhotoUrl: image.path,
                    }));
                  }
                }
              })
              .catch((e: any) => {
                logger.error('[ViewProfile] Error selecting photo', e);
                if (e.code !== 'E_PICKER_CANCELLED') {
                  Alert.alert(t('common.error', 'Error'), e.message || 'Failed to select photo');
                }
              });
          },
        },
        {
          text: t('common.cancel', 'Cancel'),
          style: 'cancel',
          onPress: () => {
            logger.debug('[ViewProfile] User cancelled photo selection');
          },
        },
      ],
      { cancelable: true },
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
            Alert.alert(t('common.error'), t('profile.invalidDateFormat'));
            return;
          }
        } else {
          Alert.alert(t('common.error'), t('profile.invalidDateFormat'));
          return;
        }
      }

      // Update profile with all data including photo (if provided)
      // If profilePhoto is a local file path, it will be uploaded as FormData
      // If profilePhoto is a server URL, it will be sent as profilePhotoUrl
      let photoToSend: string | undefined;
      let photoUrlToSend: string | undefined;
      
      if (profilePhoto) {
        if (profilePhoto.startsWith('/') || profilePhoto.startsWith('file://')) {
          // Local file path - will be uploaded as FormData
          photoToSend = profilePhoto;
        } else if (profilePhoto.startsWith('http://') || profilePhoto.startsWith('https://')) {
          // Already a server URL
          photoUrlToSend = profilePhoto;
        }
      }

      await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: dobISO,
        employmentType: employmentType.trim() || undefined,
        designation: designation.trim() || undefined,
        ...(photoToSend && { profilePhoto: photoToSend }),
        ...(photoUrlToSend && { profilePhotoUrl: photoUrlToSend }),
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
          logger.warn('Error reloading profile from DB after update', error);
          // Continue even if reload fails
        }
      }

      Alert.alert(t('common.success'), t('profile.profileUpdatedSuccessfully'));
      setIsEditMode(false);
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('profile.failedToUpdateProfile'));
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
    organization: t('profile.organization'),
    roles: t('profile.roles'),
    timezone: t('profile.timezone'),
    aadhaarVerified: t('profile.aadhaarVerified'),
    panCardVerified: t('profile.panCardVerified'),
    geofenceAreas: t('profile.geofenceAreas'),
  };

  // Format date from ISO string
  const formatDate = (dateString?: string): string => {
    if (!dateString) return t('common.none', 'None');
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return t('common.none', 'None');
      return date.toLocaleDateString();
    } catch {
      return t('common.none', 'None');
    }
  };

  return (
    <AppContainer>
      <BackHeader 
        title={t('profile.profileDetails')} 
        isTitleVisible={true}
        rightContent={
          !isEditMode ? (
            <TouchableOpacity 
              onPress={() => {
                logger.debug('[ViewProfile] Edit button pressed, setting edit mode to true');
                setIsEditMode(true);
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.editButton}
              accessibilityRole="button"
              accessibilityLabel={t('common.edit', 'Edit')}
            >
              <Image
                source={Icons.edit}
                style={[styles.editIcon, { tintColor: colors.text || DarkThemeColors.white_common }]}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.editActions}>
              <TouchableOpacity 
                onPress={handleCancel} 
                style={styles.cancelButton}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <AppText size={hp(1.8)} color={colors.text || DarkThemeColors.white_common}>
                  {t('common.cancel')}
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleSave} 
                style={styles.saveButton} 
                disabled={isLoading}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
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
          {isEditMode ? (
            <TouchableOpacity
              onPress={handleEditPhoto}
              activeOpacity={0.8}
              style={styles.photoTouchable}
            >
              <UserImage
                size={hp(15)}
                source={profilePhoto ? { uri: profilePhoto } : null}
                userName={`${firstName || userData?.firstName || ''} ${lastName || userData?.lastName || ''}`.trim()}
                isAttendanceStatusVisible={false}
                charsCount={2}
              />
            </TouchableOpacity>
          ) : (
            <UserImage
              size={hp(15)}
              source={profilePhoto ? { uri: profilePhoto } : null}
              userName={`${firstName || userData?.firstName || ''} ${lastName || userData?.lastName || ''}`.trim()}
              isAttendanceStatusVisible={false}
              charsCount={2}
            />
          )}
          {isEditMode && (
            <TouchableOpacity
              style={[styles.editPhotoButton, { backgroundColor: colors.primary || DarkThemeColors.primary }]}
              onPress={handleEditPhoto}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={t('auth.profilePhoto.edit', 'Edit Photo')}
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

        {/* Organization - Read-only */}
        <AppInput
          value={userData?.organization || userData?.organizationName || DEFAULT_VALUE}
          editable={false}
          placeholder={PROFILE_ITEMS.organization}
          label={PROFILE_ITEMS.organization}
        />

        {/* Roles - Read-only */}
        <AppInput
          value={userData?.roles?.join(', ') || DEFAULT_VALUE}
          editable={false}
          placeholder={PROFILE_ITEMS.roles}
          label={PROFILE_ITEMS.roles}
        />

        {/* Timezone - Read-only */}
        <AppInput
          value={userData?.timezone || DEFAULT_VALUE}
          editable={false}
          placeholder={PROFILE_ITEMS.timezone}
          label={PROFILE_ITEMS.timezone}
        />

        {/* Aadhaar Verification Status - Read-only */}
        <AppInput
          value={
            userData?.aadhaarVerification?.isVerified
              ? t('common.yes', 'Yes')
              : t('common.no', 'No')
          }
          editable={false}
          placeholder={PROFILE_ITEMS.aadhaarVerified}
          label={PROFILE_ITEMS.aadhaarVerified}
        />

        {/* PAN Card Verification Status - Read-only */}
        <AppInput
          value={
            userData?.aadhaarVerification?.isPanCardVerified
              ? t('common.yes', 'Yes')
              : t('common.no', 'No')
          }
          editable={false}
          placeholder={PROFILE_ITEMS.panCardVerified}
          label={PROFILE_ITEMS.panCardVerified}
        />

        {/* Allowed Geofence Areas - Read-only */}
        {userData?.allowedGeofenceAreas && userData.allowedGeofenceAreas.length > 0 && (
          <AppInput
            value={userData.allowedGeofenceAreas.map((area: any) => area.name).join(', ')}
            editable={false}
            placeholder={PROFILE_ITEMS.geofenceAreas}
            label={PROFILE_ITEMS.geofenceAreas}
          />
        )}
      </ScrollView>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={handleDatePickerCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.datePickerModal, {
            backgroundColor: appTheme === APP_THEMES.light
              ? (colors as any).cardBg || LightThemeColors.white_common
              : DarkThemeColors.black,
          }]}>
            <AppText 
              size={hp(2.5)} 
              fontType={FontTypes.medium} 
              color={colors.text || DarkThemeColors.white_common} 
              style={styles.modalTitle}
            >
              {t('profile.dateOfBirth')}
            </AppText>
            
            <View style={styles.datePickerContainer}>
              <View style={styles.datePickerRow}>
                <TouchableOpacity
                  style={[styles.datePickerButton, {
                    backgroundColor: appTheme === APP_THEMES.light
                      ? LightThemeColors.white_common
                      : DarkThemeColors.white_common + '20',
                  }]}
                  onPress={() => changeDate('year', -1)}
                >
                  <AppText 
                    size={hp(2)} 
                    color={appTheme === APP_THEMES.light 
                      ? LightThemeColors.black_common
                      : DarkThemeColors.white_common}
                  >−</AppText>
                </TouchableOpacity>
                <View style={styles.datePickerValue}>
                  <AppText 
                    size={hp(2.5)} 
                    fontType={FontTypes.medium}
                    color={colors.text || DarkThemeColors.white_common}
                  >
                    {tempDate.getFullYear()}
                  </AppText>
                  <AppText 
                    size={hp(1.5)}
                    color={colors.text || DarkThemeColors.white_common}
                    style={{ opacity: 0.7 }}
                  >{t('profile.year')}</AppText>
                </View>
                <TouchableOpacity
                  style={[styles.datePickerButton, {
                    backgroundColor: appTheme === APP_THEMES.light
                      ? LightThemeColors.white_common
                      : DarkThemeColors.white_common + '20',
                  }]}
                  onPress={() => changeDate('year', 1)}
                >
                  <AppText 
                    size={hp(2)} 
                    color={appTheme === APP_THEMES.light 
                      ? LightThemeColors.black_common
                      : DarkThemeColors.white_common}
                  >+</AppText>
                </TouchableOpacity>
              </View>

              <View style={styles.datePickerRow}>
                <TouchableOpacity
                  style={[styles.datePickerButton, {
                    backgroundColor: appTheme === APP_THEMES.light
                      ? LightThemeColors.white_common
                      : DarkThemeColors.white_common + '20',
                  }]}
                  onPress={() => changeDate('month', -1)}
                >
                  <AppText 
                    size={hp(2)} 
                    color={appTheme === APP_THEMES.light 
                      ? LightThemeColors.black_common
                      : DarkThemeColors.white_common}
                  >−</AppText>
                </TouchableOpacity>
                <View style={styles.datePickerValue}>
                  <AppText 
                    size={hp(2.5)} 
                    fontType={FontTypes.medium}
                    color={colors.text || DarkThemeColors.white_common}
                  >
                    {tempDate.toLocaleDateString('en-US', { month: 'long' })}
                  </AppText>
                  <AppText 
                    size={hp(1.5)}
                    color={colors.text || DarkThemeColors.white_common}
                    style={{ opacity: 0.7 }}
                  >{t('profile.month')}</AppText>
                </View>
                <TouchableOpacity
                  style={[styles.datePickerButton, {
                    backgroundColor: appTheme === APP_THEMES.light
                      ? LightThemeColors.white_common
                      : DarkThemeColors.white_common + '20',
                  }]}
                  onPress={() => changeDate('month', 1)}
                >
                  <AppText 
                    size={hp(2)} 
                    color={appTheme === APP_THEMES.light 
                      ? LightThemeColors.black_common
                      : DarkThemeColors.white_common}
                  >+</AppText>
                </TouchableOpacity>
              </View>

              <View style={styles.datePickerRow}>
                <TouchableOpacity
                  style={[styles.datePickerButton, {
                    backgroundColor: appTheme === APP_THEMES.light
                      ? LightThemeColors.white_common
                      : DarkThemeColors.white_common + '20',
                  }]}
                  onPress={() => changeDate('day', -1)}
                >
                  <AppText 
                    size={hp(2)} 
                    color={appTheme === APP_THEMES.light 
                      ? LightThemeColors.black_common
                      : DarkThemeColors.white_common}
                  >−</AppText>
                </TouchableOpacity>
                <View style={styles.datePickerValue}>
                  <AppText 
                    size={hp(2.5)} 
                    fontType={FontTypes.medium}
                    color={colors.text || DarkThemeColors.white_common}
                  >
                    {tempDate.getDate()}
                  </AppText>
                  <AppText 
                    size={hp(1.5)}
                    color={colors.text || DarkThemeColors.white_common}
                    style={{ opacity: 0.7 }}
                  >{t('profile.day')}</AppText>
                </View>
                <TouchableOpacity
                  style={[styles.datePickerButton, {
                    backgroundColor: appTheme === APP_THEMES.light
                      ? LightThemeColors.white_common
                      : DarkThemeColors.white_common + '20',
                  }]}
                  onPress={() => changeDate('day', 1)}
                >
                  <AppText 
                    size={hp(2)} 
                    color={appTheme === APP_THEMES.light 
                      ? LightThemeColors.black_common
                      : DarkThemeColors.white_common}
                  >+</AppText>
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
  photoTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
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
  editButton: {
    padding: hp(1),
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
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
