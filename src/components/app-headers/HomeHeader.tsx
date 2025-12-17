import React, { memo, useCallback, useMemo, useState, useEffect } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useTheme } from '@react-navigation/native';
import moment from 'moment';

import { hp, Icons, wp } from '../../constants';
import { UserImage } from '../../components';
import { NavigationProp } from '../../types/navigation';
import { PUNCH_DIRECTIONS } from '../../constants';
import { useAppSelector } from '../../redux';
import { profileSyncService } from '../../services/sync/profile-sync-service';
import { getProfile } from '../../services';
import { getJWTToken } from '../../services/auth/login-service';
import { logger } from '../../services/logger';

interface HomeHeaderProps {
  bgColor?: string | Animated.Value | Animated.AnimatedInterpolation<string | number>;
  borderBottomColor?: string | Animated.Value | Animated.AnimatedInterpolation<string | number>;
  punchTimestamp?: string | number | null;
  checkoutTimestamp?: string | number | null;
  punchDirection?: typeof PUNCH_DIRECTIONS[keyof typeof PUNCH_DIRECTIONS];
  textColor?: string | Animated.Value | Animated.AnimatedInterpolation<string | number>;
  userName?: string;
}

const HomeHeader: React.FC<HomeHeaderProps> = ({
  bgColor = 'transparent',
  borderBottomColor = 'transparent',
  punchTimestamp = null,
  checkoutTimestamp = null,
  punchDirection,
  textColor,
  userName = '',
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { userData } = useAppSelector(state => state.userState);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  // Load profile photo from DB
  useEffect(() => {
    const loadProfilePhoto = async () => {
      if (!userData?.email) {
        setProfilePhoto(userData?.profilePhotoUrl || null);
        return;
      }
      
      try {
        const dbProfile = await profileSyncService.loadProfileFromDB(userData.email);
        if (dbProfile) {
          setProfilePhoto(dbProfile.profilePhotoUrl || null);
        } else {
          setProfilePhoto(userData?.profilePhotoUrl || null);
        }
      } catch (error) {
        logger.warn('Error loading profile photo from DB', error);
        setProfilePhoto(userData?.profilePhotoUrl || null);
      }
    };
    
    loadProfilePhoto();
  }, [userData?.email, userData?.profilePhotoUrl]);

  // Always show today's date (not from punch timestamp)
  const formattedDate = useMemo(
    () => moment().format('DD MMM, YY'), // Always show current date
    [],
  );
  
  
  const formattedTime = useMemo(
    () => {
      // Date comparisons use UTC for logic, display uses local time
      const todayUTC = moment.utc().format('YYYY-MM-DD');
      
      let checkInTimeStr = '';
      let checkoutTimeStr = '';
      
      // Get first check-in time if available and from today
      if (punchTimestamp) {
        const checkInDateUTC = moment.utc(punchTimestamp).format('YYYY-MM-DD');
        if (checkInDateUTC === todayUTC) {
          checkInTimeStr = moment(punchTimestamp).format('hh:mm A');
        }
      }
      
      // Get last checkout time if available and from today
      if (checkoutTimestamp) {
        const checkoutDateUTC = moment.utc(checkoutTimestamp).format('YYYY-MM-DD');
        if (checkoutDateUTC === todayUTC) {
          checkoutTimeStr = moment(checkoutTimestamp).format('hh:mm A');
        }
      }
      
      // Build display string: first check-in and last checkout
      if (checkInTimeStr && checkoutTimeStr) {
        return `${checkInTimeStr} IN | ${checkoutTimeStr} OUT`;
      } else if (checkInTimeStr) {
        // Only check-in available
        return `${checkInTimeStr} IN`;
      } else if (checkoutTimeStr) {
        // Only checkout available (shouldn't happen normally, but handle it)
        return `${checkoutTimeStr} OUT`;
      }
      
      // If no attendance today, don't show any time
      return '';
    },
    [punchTimestamp, checkoutTimestamp],
  );

  const headerContainerStyle = useMemo(
    () => [
      styles.headerContainer,
      {
        paddingTop: insets.top || wp('2%'),
        backgroundColor: bgColor, // can now be Animated.Value
        borderBottomColor, // can now be Animated.Value
      },
    ],
    [insets.top, bgColor, borderBottomColor],
  );

  const onProfilePress = useCallback(async (): Promise<void> => {
    // Sync profile from server when profile icon is clicked (only if authenticated)
    if (userData?.email) {
      try {
        // Check if authentication token exists before attempting to sync
        const token = await getJWTToken(userData.email);
        if (token) {
          await getProfile(); // This will sync profile data to DB
          
          // Reload profile photo from DB after sync
          const dbProfile = await profileSyncService.loadProfileFromDB(userData.email);
          if (dbProfile) {
            setProfilePhoto(dbProfile.profilePhotoUrl || null);
          }
        } else {
          // No token - just load from DB without syncing
          const dbProfile = await profileSyncService.loadProfileFromDB(userData.email);
          if (dbProfile) {
            setProfilePhoto(dbProfile.profilePhotoUrl || null);
          }
        }
      } catch (error) {
        // Log error but don't prevent navigation
        logger.warn('Error syncing profile on icon click', error);
        // Still try to load from DB as fallback
        try {
          const dbProfile = await profileSyncService.loadProfileFromDB(userData.email);
          if (dbProfile) {
            setProfilePhoto(dbProfile.profilePhotoUrl || null);
          }
        } catch (dbError) {
          // Ignore DB errors - just use existing state
        }
      }
    }
    
    navigation.navigate('ProfileDrawerScreen');
  }, [navigation, userData?.email]);

  return (
    <Animated.View style={styles.container}>
      <Animated.View style={headerContainerStyle}>
        <UserImage
          source={profilePhoto ? { uri: profilePhoto } : null}
          userName={userName || `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || undefined}
          size={wp('10%')}
          isClickable
          punchDirection={punchDirection}
          onPress={onProfilePress}
          charsCount={2}
        />
        <Animated.View style={styles.middleSection}>
          <Animated.Text style={{ color: textColor || colors.text }}>
            {formattedDate}
          </Animated.Text>
          {formattedTime ? (
            <Animated.Text style={{ color: textColor || colors.text }}>
              {formattedTime}
            </Animated.Text>
          ) : null}
        </Animated.View>
        <Animated.Image
          style={styles.chatIcon}
          source={Icons.chat}
          tintColor={textColor || colors.text}
        />
      </Animated.View>
    </Animated.View>
  );
};

function areEqual(
  prevProps: HomeHeaderProps,
  nextProps: HomeHeaderProps,
): boolean {
  // Note: This comparison doesn't include userData.profilePhoto changes
  // because userData comes from Redux, not props. The component will
  // re-render when Redux state changes anyway.
  return (
    prevProps.userName === nextProps.userName &&
    prevProps.punchTimestamp === nextProps.punchTimestamp &&
    prevProps.checkoutTimestamp === nextProps.checkoutTimestamp &&
    prevProps.punchDirection === nextProps.punchDirection
  );
}

export default memo(HomeHeader, areEqual);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('5%'),
    paddingVertical: wp('2%'),
    borderBottomWidth: 1,
  },
  middleSection: { flex: 1, paddingHorizontal: wp('3%') },
  chatIcon: {
    height: hp(3),
    width: hp(3),
    resizeMode: 'contain',
  },
});

