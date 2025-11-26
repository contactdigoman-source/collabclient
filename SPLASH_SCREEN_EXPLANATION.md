# How the Splash Screen Works in iOS

## Overview
The splash screen loading process involves multiple steps that work together to provide a smooth transition from the native iOS launch screen to your React Native app.

## Step-by-Step Flow

### Phase 1: Native iOS Launch (Automatic)
**File: `Info.plist` (Line 46-47)**
```xml
<key>UILaunchStoryboardName</key>
<string>BootSplash</string>
```

When the user taps your app icon:
1. iOS immediately displays `BootSplash.storyboard` as a static launch screen
2. This happens **instantly** - even before your Swift code runs
3. Shows black background (defined in BootSplash.storyboard)
4. No code execution yet - pure native iOS behavior

---

### Phase 2: App Initialization
**File: `AppDelegate.swift` (Lines 14-34)**

```swift
func application(
  _ application: UIApplication,
  didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
) -> Bool {
```

**What happens here:**
1. iOS calls `application(_:didFinishLaunchingWithOptions:)` - this is the entry point
2. Creates a `ReactNativeDelegate` to handle React Native setup
3. Creates a `RCTReactNativeFactory` to build the React Native view
4. Sets up the main window
5. Starts React Native with `factory.startReactNative(...)`

**Key Point:** At this stage, `BootSplash.storyboard` is still visible because it's the active window content.

---

### Phase 3: React Native Bridge Setup
**File: `AppDelegate.swift` (Lines 37-45)**

```swift
class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func customize(_ rootView: RCTRootView) {
    super.customize(rootView)
    RNBootSplash.initWithStoryboard("BootSplash", rootView: rootView)
  }
}
```

**What happens here:**
1. When React Native creates the root view, it calls `customize(_:)`
2. **This is the critical line:** `RNBootSplash.initWithStoryboard("BootSplash", rootView: rootView)`
3. This method:
   - Finds the `BootSplash.storyboard` file
   - Creates a view controller from it
   - Overlays it on top of the React Native root view
   - Keeps the splash visible until you explicitly hide it

**Result:** The splash screen is now programmatically controlled and sits on top of your React Native app.

---

### Phase 4: React Native JavaScript Loads
**File: `AppDelegate.swift` (Lines 47-53)**

```swift
override func bundleURL() -> URL? {
  #if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
  #else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
  #endif
}
```

1. In DEBUG mode: Connects to Metro bundler (development server)
2. In RELEASE mode: Loads pre-bundled JavaScript from the app package
3. JavaScript starts executing
4. Your React Native app begins to render

**Important:** Splash screen is still visible during this entire process!

---

### Phase 5: Hide the Splash Screen
**File: `App.tsx` (Line 22)**

```javascript
React.useEffect(() => {
  BootSplash.hide();
}, []);
```

**What happens:**
1. When your React Native component mounts, `useEffect` runs
2. Calls `BootSplash.hide()` - this is a native bridge call
3. The native side (RNBootSplash library) removes the splash overlay
4. Your actual app content becomes visible

---

## Visual Timeline

```
Time → 
│
├─ [0ms]      User taps app icon
│             └─ iOS shows BootSplash.storyboard (black screen)
│
├─ [50ms]     AppDelegate.application() starts
│             └─ React Native factory initializes
│
├─ [100ms]    customize() called
│             └─ RNBootSplash.initWithStoryboard() overlays splash
│
├─ [200ms]    JavaScript bundle starts loading
│             └─ Splash still visible
│
├─ [500ms]    React Native app starts rendering
│             └─ Splash still visible (on top)
│
├─ [800ms]    App.tsx useEffect runs
│             └─ BootSplash.hide() called
│
└─ [850ms]    Splash fades out / removed
              └─ Your app content visible
```

---

## Key Components

### 1. **Info.plist - UILaunchStoryboardName**
- Points iOS to use `BootSplash.storyboard` as the launch screen
- Shows immediately on app launch
- No code needed - pure iOS behavior

### 2. **BootSplash.storyboard**
- Contains the visual design of the splash (currently black background)
- Loaded instantly by iOS
- Stays visible until removed programmatically

### 3. **RNBootSplash.initWithStoryboard()**
- Takes control of the launch screen
- Creates an overlay that sits on top of React Native
- Maintains splash visibility during app initialization

### 4. **BootSplash.hide()**
- Removes the splash overlay
- Called from JavaScript when your app is ready
- Provides smooth transition to app content

---

## Why This Architecture?

1. **Instant Visual Feedback:** Launch storyboard shows immediately (iOS native)
2. **Seamless Transition:** BootSplash maintains visibility during React Native startup
3. **No Flash:** Avoids white screen between native launch and React Native render
4. **Programmatic Control:** JavaScript decides when to hide the splash

---

## Current Configuration

- **Launch Storyboard:** `BootSplash.storyboard`
- **Background Color:** Black (#000000)
- **Content:** None (just black background)
- **Hide Trigger:** When `App.tsx` mounts and calls `BootSplash.hide()`

