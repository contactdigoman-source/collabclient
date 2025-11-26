# Performance Optimizations Guide

## ✅ Already Implemented
- Redux middleware optimized (immutableCheck threshold)
- DevTools disabled in production
- useMemo, useCallback in HomeScreen
- MMKV for fast storage (faster than AsyncStorage)

## 🚀 Quick Wins (Apply Now)

### 1. **Component Memoization**
Wrap expensive components with `React.memo`:

```js
// src/components/app-list-items/AttendanceLogItem.js
export default React.memo(AttendanceLogItem);

// src/components/app-images/UserImage.js
export default React.memo(UserImage);
```

### 2. **FlatList Optimizations**
Already good in HomeScreen, but ensure all lists use:
```js
<FlatList
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  windowSize={10}
  initialNumToRender={10}
  updateCellsBatchingPeriod={50}
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
/>
```

### 3. **Image Optimization**
- Use `react-native-fast-image` (already installed) everywhere
- Preload critical images on app start
- Use WebP format where possible

### 4. **Lazy Loading Screens**
```js
// src/navigation/index.js
const LoginScreen = React.lazy(() => import('../screens/LoginScreen'));
const HomeScreen = React.lazy(() => import('../screens/HomeScreen'));
```

### 5. **Reduce Re-renders with Selectors**
Create specific selectors instead of selecting entire state:

```js
// src/redux/selectors.js
export const selectAppTheme = (state) => state.appState.appTheme;
export const selectUserData = (state) => state.userState.userData;
export const selectLastAttendance = (state) => state.userState.userLastAttendance;

// In components:
const appTheme = useAppSelector(selectAppTheme); // Only re-renders when theme changes
```

### 6. **Debounce Search/Input**
```js
import { debounce } from 'lodash';
const debouncedSearch = useMemo(
  () => debounce((text) => handleSearch(text), 300),
  []
);
```

### 7. **Disable Console in Production**
```js
// App.tsx or index.js
if (!__DEV__) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}
```

### 8. **Optimize Maps**
```js
// Only update map region when significantly changed
const shouldUpdateMap = useMemo(() => {
  const oldLat = prevRegion?.latitude;
  const newLat = region?.latitude;
  return Math.abs(oldLat - newLat) > 0.001; // ~100m threshold
}, [region]);
```

### 9. **SQLite Query Optimization**
```js
// Use indexes (already done)
// Batch inserts
// Use transactions for multiple operations
db.transaction(tx => {
  records.forEach(record => {
    tx.executeSql('INSERT INTO ...', [...]);
  });
});
```

### 10. **Bundle Size Reduction**
```bash
# Analyze bundle
npx react-native-bundle-visualizer

# Remove unused dependencies
npm prune
```

## 📊 Performance Monitoring

### Add Flipper Performance Plugin
```bash
npm i --save-dev react-native-performance-monitor
```

### Use React DevTools Profiler
- Record renders
- Identify slow components
- Check unnecessary re-renders

## 🎯 Priority Actions

1. **High Impact, Low Effort:**
   - ✅ Redux middleware optimization (done)
   - Add React.memo to list items
   - Disable console in production
   - Use specific selectors

2. **Medium Impact:**
   - Lazy load screens
   - Optimize FlatList props
   - Debounce inputs

3. **Long Term:**
   - Code splitting
   - Image CDN
   - Consider Hermes (already enabled in RN 0.80)

## 🔍 Measure Before/After

```js
// Add performance markers
console.time('HomeScreenRender');
// ... component code
console.timeEnd('HomeScreenRender');
```

## 📝 Notes
- Hermes is enabled by default in RN 0.80 (faster JS execution)
- MMKV is already faster than AsyncStorage
- Redux Persist whitelist reduces storage overhead

