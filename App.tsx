import * as React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigation from './src/navigation';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { persistor, store } from './src/redux';
import { DarkThemeColors } from './src/themes';
import './src/i18n'; // Initialize i18n
import { getCorrelationId } from './src/services/logger'; // Initialize correlation ID
import { ErrorBoundary} from './src/services/error-handler';

// Default loading spinner component for PersistGate
const LoadingSpinner = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color={DarkThemeColors.primary} />
  </View>
);

export default function App() {
  // Initialize correlation ID and error handlers on app startup
  React.useEffect(() => {
    getCorrelationId();
    // initializeGlobalErrorHandlers();
    // captureConsoleErrors();
  }, []);
  
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.flex1}>
        <SafeAreaProvider>
          <View style={styles.container}>
            <Provider store={store}>
              <PersistGate loading={<LoadingSpinner />} persistor={persistor}>
                <AppNavigation />
              </PersistGate>
            </Provider>
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DarkThemeColors.black,
  },
});
