import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableWithoutFeedback,
  Easing as RNEasing,
  AccessibilityInfo,
  ViewStyle,
  Animated as RNAnimated,
} from 'react-native';
import { wp } from '../../constants';
import { useTheme } from '@react-navigation/native';

type AnimatedModule = typeof RNAnimated | null;

let Animated: AnimatedModule;
try {
  Animated = require('react-native').Animated;
} catch (e) {
  Animated = null;
}

interface AnimatedSwitchProps {
  value?: boolean;
  onValueChange?: (newValue: boolean) => void;
  width?: number;
  height?: number;
  thumbSize?: number;
  activeColor?: string;
  inactiveColor?: string;
  duration?: number;
  disabled?: boolean;
  style?: ViewStyle;
}

interface ComputedStyle {
  translateX: RNAnimated.AnimatedInterpolation<string | number> | number;
  backgroundColor: RNAnimated.AnimatedInterpolation<string> | string;
  labelOpacity?: RNAnimated.AnimatedInterpolation<number> | number;
  labelOpacityInverse?: RNAnimated.AnimatedInterpolation<number> | number;
}

/**
 * AnimatedSwitch
 *
 * Props:
 *  - value: boolean
 *  - onValueChange: (newValue: boolean) => void
 *  - width, height: number
 *  - thumbSize: number
 *  - activeColor, inactiveColor: string
 *  - duration: animation duration in ms
 *  - disabled: boolean
 *
 * This component will use React Native's Animated when available. If Animated
 * is unavailable (bundler environment / web playground), it will gracefully
 * fall back to a JS-based tween so the component still works.
 */
export default function AnimatedSwitch(props: AnimatedSwitchProps): React.JSX.Element {
  const { colors } = useTheme();
  const {
    value = false,
    onValueChange = () => {},
    width = wp(13),
    height = wp(7),
    thumbSize = wp(5),
    activeColor = colors.switch_active_bg,
    inactiveColor = colors.switch_inactive_bg,
    duration = 200,
    style,
    disabled = false,
  } = props;
  // If we have Animated, use it; otherwise fall back to a simple numeric state
  const useAnimated = Boolean(Animated);

  // Animated path
  const animRef = useRef<RNAnimated.Value | null>(
    useAnimated && Animated ? new Animated.Value(value ? 1 : 0) : null,
  );

  // Fallback path: simple number between 0 and 1
  const [fallbackProgress, setFallbackProgress] = useState<number>(value ? 1 : 0);
  const rafRef = useRef<number | null>(null);

  // Keep animated value in sync when `value` prop changes
  useEffect(() => {
    if (useAnimated && animRef.current && Animated) {
      Animated.timing(animRef.current, {
        toValue: value ? 1 : 0,
        duration,
        easing: RNEasing ? RNEasing.out(RNEasing.cubic) : undefined,
        useNativeDriver: false, // we animate colors/layout which require JS driver
      }).start();
    } else {
      // Fallback: animate the numeric value using requestAnimationFrame
      const start = Date.now();
      const from = fallbackProgress;
      const to = value ? 1 : 0;
      const diff = to - from;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      if (duration <= 0) {
        setFallbackProgress(to);
        return;
      }

      const step = (): void => {
        const now = Date.now();
        const t = Math.min(1, (now - start) / duration);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - t, 3);
        setFallbackProgress(from + diff * eased);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = null;
        }
      };
      rafRef.current = requestAnimationFrame(step);

      return () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  // Derived values for rendering
  const progress = useAnimated && animRef.current ? animRef.current : null;

  // Helper to read the current progress value in a synchronous way for styles
  // When using Animated we rely on interpolation inside style objects; when
  // using fallback we compute the values directly from fallbackProgress.
  const computeStyle = (): ComputedStyle => {
    if (useAnimated && progress && Animated) {
      const translateX = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [wp(1), width - thumbSize - wp(1)],
      });

      const backgroundColor = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [inactiveColor, activeColor],
      });

      const labelOpacity = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
      });
      const labelOpacityInverse = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
      });

      return { translateX, backgroundColor, labelOpacity, labelOpacityInverse };
    }

    // fallback numeric values
    const p = Math.max(0, Math.min(1, fallbackProgress));
    const translate = wp(1) + (width - thumbSize - wp(2)) * p; // padding both sides ~2

    // simple color interpolation (hex to rgb interpolation would be better,
    // but for safety do a very simple interpolation for common hex colors)
    const lerpColor = (a: string, b: string, t: number): string => {
      // accept #rrggbb
      const ah = a.replace('#', '');
      const bh = b.replace('#', '');
      const ar = parseInt(ah.substring(0, 2), 16);
      const ag = parseInt(ah.substring(2, 4), 16);
      const ab = parseInt(ah.substring(4, 6), 16);
      const br = parseInt(bh.substring(0, 2), 16);
      const bgc = parseInt(bh.substring(2, 4), 16);
      const bb = parseInt(bh.substring(4, 6), 16);
      const rr = Math.round(ar + (br - ar) * t);
      const gg = Math.round(ag + (bgc - ag) * t);
      const bbv = Math.round(ab + (bb - ab) * t);
      return `rgb(${rr}, ${gg}, ${bbv})`;
    };

    const backgroundColor = lerpColor(inactiveColor, activeColor, p);
    const labelOpacity = 1 - p;
    const labelOpacityInverse = p;

    return {
      translateX: translate,
      backgroundColor,
      labelOpacity,
      labelOpacityInverse,
    };
  };

  const { translateX, backgroundColor } = computeStyle();

  const onPress = (): void => {
    if (disabled) return;
    const newValue = !value;
    // announce for accessibility (guard for platforms that support it)
    try {
      if (
        AccessibilityInfo &&
        typeof AccessibilityInfo.announceForAccessibility === 'function'
      ) {
        AccessibilityInfo.announceForAccessibility(
          `Switch ${newValue ? 'on' : 'off'}`,
        );
      }
    } catch (e) {
      // ignore
    }
    onValueChange(newValue);
  };

  // Render
  return (
    <TouchableWithoutFeedback
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
    >
      {/* If Animated is available we use Animated.View/Text for smooth interpolation
          otherwise we fall back to View/Text and use inline styles computed above. */}
      {useAnimated && Animated ? (
        <Animated.View
          style={[
            styles.container,
            { width, height, borderRadius: height / 2 },
            style,
            { backgroundColor: backgroundColor as RNAnimated.AnimatedInterpolation<string> },
          ]}
        >
          <Animated.View
            style={[
              styles.thumb,
              {
                width: thumbSize,
                height: thumbSize,
                borderRadius: thumbSize / 2,
                transform: [{ translateX: translateX as RNAnimated.AnimatedInterpolation<number> }],
                top: (height - thumbSize) / 2,
                elevation: 2,
                shadowColor: '#000',
                shadowOpacity: 0.15,
                shadowOffset: { width: 0, height: 1 },
                shadowRadius: 2,
              },
            ]}
          />
        </Animated.View>
      ) : (
        <View
          style={[
            styles.container,
            { width, height, borderRadius: height / 2 },
            style,
            { backgroundColor: backgroundColor as string },
          ]}
        >
          <View
            style={[
              styles.thumb,
              {
                width: thumbSize,
                height: thumbSize,
                borderRadius: thumbSize / 2,
                left: translateX as number,
                top: (height - thumbSize) / 2,
                elevation: 2,
                shadowColor: '#000',
                shadowOpacity: 0.15,
                shadowOffset: { width: 0, height: 1 },
                shadowRadius: 2,
              },
            ]}
          />
        </View>
      )}
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    paddingHorizontal: wp(1),
  },
  thumb: {
    backgroundColor: '#fff',
    position: 'absolute',
  },
  label: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 12,
    color: '#111',
  },
});

