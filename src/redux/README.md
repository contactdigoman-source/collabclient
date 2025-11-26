# Redux Structure

This folder is organized into clear sections for better maintainability:

## 📁 Folder Structure

```
redux/
├── reducers/          # All Redux reducers (slices)
│   ├── appReducer.ts
│   ├── userReducer.ts
│   ├── aadhaarReducer.ts
│   └── index.ts       # Exports all reducers and actions
│
├── actions/           # Future async actions, thunks
│   └── index.ts       # Placeholder for future async actions
│
├── store/             # Store configuration
│   ├── store.ts       # Redux store setup
│   ├── storage.ts     # MMKV storage adapter
│   └── index.ts       # Exports store, persistor, types
│
├── selectors.ts       # Optimized selectors for components
└── index.ts           # Main entry point - exports everything
```

## 📦 Usage

### Import from main entry point:
```js
// ✅ Recommended - Clean imports
import { 
  store, 
  persistor,
  useAppDispatch, 
  useAppSelector,
  setUserData,
  setAppTheme,
  selectAppTheme,
  selectUserData 
} from '../redux';
```

### Direct imports (if needed):
```js
// For store only
import { store } from '../redux/store';

// For specific reducer actions
import { setUserData } from '../redux/reducers';
```

## 🎯 Benefits

1. **Clear Separation**: Reducers, actions, and store are separated
2. **Easy to Find**: Know exactly where to look for each piece
3. **Scalable**: Easy to add new reducers or async actions
4. **Clean Imports**: Single entry point exports everything needed

## 🔄 Migration Notes

All imports have been updated to use the new structure. The main `redux/index.ts` exports everything, so existing code continues to work with cleaner imports.

