# Source Code Structure

## 📁 Folder Organization

### Screens (`src/screens/`)
Organized by functionality:

```
screens/
├── auth/                    # Authentication flows
│   ├── LoginScreen.js
│   ├── ForgotPasswordScreen.js
│   ├── OtpScreen.js
│   └── ChangeForgottenPassword.js
│
├── attendance/              # Attendance management
│   ├── ConfirmPunchScreen.js
│   ├── AttendanceLogsScreen.js
│   └── DaysBottomTabScreen.js
│
├── home/                    # Home/Dashboard
│   └── HomeScreen.js
│
├── profile/                 # User profile
│   ├── ProfileDrawerScreen.js
│   └── ViewProfileScreen.js
│
├── aadhaar/                 # Aadhaar verification
│   └── AadhaarInputScreen.js
│
├── legal/                   # Legal/Policy screens
│   └── PrivacyPolicyScreen.js
│
└── index.js                 # Exports all screens
```

**Usage:**
```js
import { LoginScreen, HomeScreen } from '../screens';
```

### Services (`src/services/`)
Organized by domain:

```
services/
├── attendance/              # Attendance services
│   ├── attendance-db-service.js
│   ├── attendance-service.js
│   └── index.js
│
├── auth/                    # Authentication services
│   ├── login-service.js
│   └── index.js
│
├── location/                # Location services
│   ├── location-service.js
│   └── index.js
│
├── aadhaar/                 # Aadhaar services
│   ├── aadhaar-facerd-service.js
│   └── index.js
│
└── index.js                 # Exports all services
```

**Usage:**
```js
import { 
  createTableForAttendance,
  insertAttendancePunchRecord,
  logoutUser,
  getCurrentPositionOfUser,
  checkAadhaarDataAvailability
} from '../services';
```

### Redux (`src/redux/`)
Organized by concern:

```
redux/
├── reducers/                # Redux reducers (slices)
│   ├── appReducer.ts
│   ├── userReducer.ts
│   ├── aadhaarReducer.ts
│   └── index.ts
│
├── selectors/               # Optimized selectors
│   ├── appSelectors.ts
│   ├── userSelectors.ts
│   ├── aadhaarSelectors.ts
│   └── index.ts
│
├── store/                   # Store configuration
│   ├── store.ts
│   ├── storage.ts
│   └── index.ts
│
├── types/                   # TypeScript types
│   ├── userTypes.ts
│   ├── appTypes.ts
│   ├── aadhaarTypes.ts
│   └── index.ts
│
└── index.ts                 # Main entry point
```

**Usage:**
```js
import { 
  store,
  useAppDispatch,
  useAppSelector,
  setUserData,
  selectAppTheme,
  UserData,
  AttendanceRecord
} from '../redux';
```

## 🎯 Benefits

1. **Clear Organization**: Easy to find files by functionality
2. **Clean Imports**: Use index files for cleaner imports
3. **Scalable**: Easy to add new screens/services in appropriate folders
4. **Type Safety**: TypeScript types for all Redux state
5. **Maintainable**: Related code grouped together

## 📝 Import Guidelines

✅ **DO:**
```js
// Use index files
import { LoginScreen } from '../screens';
import { logoutUser } from '../services';
import { setUserData } from '../redux';
```

❌ **DON'T:**
```js
// Direct file imports
import LoginScreen from '../screens/auth/LoginScreen';
import logoutUser from '../services/auth/login-service';
```

