# JavaScript to TypeScript Conversion Guide

This document tracks the conversion of all `.js` files to TypeScript (`.ts` or `.tsx`).

## Conversion Status

### ✅ Completed
- `src/services/auth/first-time-login-service.ts`
- `src/services/auth/login-service.ts`
- `src/services/auth/index.ts`
- `src/services/index.ts`
- `src/screens/auth/FirstTimeLoginScreen.tsx`
- `src/navigation/index.tsx`
- `src/screens/index.ts`
- `src/types/navigation.ts` (new)

### 🔄 Remaining Files (47)

#### Constants (5 files)
- `src/constants/Icons.js` → `.ts`
- `src/constants/index.js` → `.ts`
- `src/constants/configs.js` → `.ts`
- `src/constants/location.js` → `.ts`
- `src/constants/Images.js` → `.ts`

#### Themes (4 files)
- `src/themes/light.js` → `.ts`
- `src/themes/index.js` → `.ts`
- `src/themes/colors.js` → `.ts`
- `src/themes/dark.js` → `.ts`

#### Services (9 files)
- `src/services/attendance/index.js` → `.ts`
- `src/services/attendance/attendance-db-service.js` → `.ts`
- `src/services/attendance/attendance-service.js` → `.ts`
- `src/services/location/index.js` → `.ts`
- `src/services/location/location-service.js` → `.ts`
- `src/services/security-service.js` → `.ts`
- `src/services/aadhaar/index.js` → `.ts`
- `src/services/aadhaar/aadhaar-facerd-service.js` → `.ts`

#### Navigation (1 file)
- `src/navigation/BottomTabBar.js` → `.tsx`

#### Screens (12 files)
- `src/screens/attendance/ConfirmPunchScreen.js` → `.tsx`
- `src/screens/attendance/DaysBottomTabScreen.js` → `.tsx`
- `src/screens/attendance/AttendanceLogsScreen.js` → `.tsx`
- `src/screens/home/HomeScreen.js` → `.tsx`
- `src/screens/security/UsbDebuggingBlockScreen.js` → `.tsx`
- `src/screens/auth/ForgotPasswordScreen.js` → `.tsx`
- `src/screens/auth/OtpScreen.js` → `.tsx`
- `src/screens/auth/ChangeForgottenPassword.js` → `.tsx`
- `src/screens/auth/LoginScreen.js` → `.tsx`
- `src/screens/profile/ProfileDrawerScreen.js` → `.tsx`
- `src/screens/profile/ViewProfileScreen.js` → `.tsx`
- `src/screens/legal/PrivacyPolicyScreen.js` → `.tsx`
- `src/screens/aadhaar/AadhaarInputScreen.js` → `.tsx`

#### Components (16 files)
- `src/components/app-buttons/RippleButton.js` → `.tsx`
- `src/components/app-buttons/AppIconButton.js` → `.tsx`
- `src/components/app-buttons/AppButton.js` → `.tsx`
- `src/components/app-texts/AppText.js` → `.tsx`
- `src/components/app-inputs/AppInput.js` → `.tsx`
- `src/components/app-list-items/ChatListItem.js` → `.tsx`
- `src/components/app-list-items/AttendanceLogItem.js` → `.tsx`
- `src/components/app-list-items/ProfileDrawerItem.js` → `.tsx`
- `src/components/app-list-items/MyTeamListItem.js` → `.tsx`
- `src/components/index.js` → `.tsx`
- `src/components/app-container/AppContainer.js` → `.tsx`
- `src/components/app-switches/AnimatedSwitch.js` → `.tsx`
- `src/components/app-images/AppImage.js` → `.tsx`
- `src/components/app-images/UserImage.js` → `.tsx`
- `src/components/app-maps/AppMap.js` → `.tsx`
- `src/components/app-headers/HomeHeader.js` → `.tsx`
- `src/components/app-headers/BackHeader.js` → `.tsx`

## Conversion Pattern

### For `.js` → `.ts` (Services, Constants, Themes):
1. Change file extension from `.js` to `.ts`
2. Add return type annotations to functions
3. Add parameter type annotations
4. Add interface/type definitions where needed

### For `.js` → `.tsx` (React Components, Screens):
1. Change file extension from `.js` to `.tsx`
2. Add `React.JSX.Element` return type to components
3. Add props interfaces/types
4. Type useState, useRef, useCallback, etc.
5. Use `NavigationProp` from `../types/navigation` for navigation
6. Add proper types for StyleSheet.create()

## Next Steps

Run the conversion script to see remaining files:
```bash
find src -name "*.js" -type f
```

Then convert files systematically, starting with constants and themes (simpler), then services, then components and screens.

