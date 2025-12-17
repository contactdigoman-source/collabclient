import React, { memo, useMemo, useCallback, ReactNode, forwardRef } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import MapView, { Region } from 'react-native-maps';
import { useAppSelector } from '../../redux';
import { DEFAULT_REGION, hp, Icons, wp, Region as RegionType } from '../../constants';
import AppImage from '../app-images/AppImage';
import { useTheme } from '@react-navigation/native';
import RippleButton from '../app-buttons/RippleButton';
import { logger } from '../../services/logger';

interface AppMapProps {
  style?: ViewStyle;
  region?: Region | RegionType;
  isRefreshButton?: boolean;
  onRefreshPress?: () => void;
  children?: ReactNode;
  [key: string]: any;
}

const AppMap = forwardRef<MapView, AppMapProps>(({
  style = {},
  region = DEFAULT_REGION,
  isRefreshButton = false,
  onRefreshPress = () => {},
  children,
  ...rest
}, ref) => {
  const { colors } = useTheme();

  // ✅ Extract only what's needed to avoid unnecessary re-renders
  const appTheme = useAppSelector(state => state.appState.appTheme);

  // ✅ Memoize static props to avoid object recreation each render
  const commonProps = useMemo(
    () => ({
      zoomEnabled: true,
      toolbarEnabled: false,
      scrollEnabled: true,
      rotateEnabled: false,
      zoomControlEnabled: false,
    }),
    [],
  );

  // ✅ Memoize styles that depend on dynamic colors
  const refreshButtonStyle = useMemo(
    () => [
      styles.refreshIcon,
      {
        backgroundColor: colors.white_common,
        shadowColor: colors.black_common,
      },
    ],
    [colors.white_common, colors.black_common],
  );

  // ✅ Stable callback reference for performance
  const handleRefreshPress = useCallback((): void => {
    onRefreshPress();
  }, [onRefreshPress]);

  logger.debug('AppMap rendered', { region });

  return (
    <View style={style}>
      <MapView
        ref={ref}
        key={appTheme} // re-render only when theme changes
        style={[styles.map, style]}
        initialRegion={region as Region}
        region={region as Region}
        {...commonProps}
        {...rest}
      >
        {children}
      </MapView>

      {isRefreshButton && (
        <RippleButton
          rippleColor={colors.black_common}
          rippleContainerBorderRadius={hp('2%')}
          style={refreshButtonStyle}
          onPress={handleRefreshPress}
        >
          <AppImage
            size={hp('2.5%')}
            source={Icons.location_reset}
            tintColor={colors.text}
          />
        </RippleButton>
      )}
    </View>
  );
});

AppMap.displayName = 'AppMap';

export default memo(AppMap);

const styles = StyleSheet.create({
  map: { width: wp(100) },
  refreshIcon: {
    position: 'absolute',
    bottom: hp('2%'),
    right: hp('2%'),
    height: hp('3.5%'),
    width: hp('3.5%'),
    borderRadius: hp('2%'),
    alignItems: 'center',
    justifyContent: 'center',
    elevation: hp('1.49%'),
    shadowOffset: {
      width: 0,
      height: hp('0.5%'),
    },
    shadowOpacity: 0.2,
    shadowRadius: hp('0.99%'),
  },
});

