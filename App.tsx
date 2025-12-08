import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BootSplash from 'react-native-bootsplash';
import Config from 'react-native-config';

import AppNavigation from './src/navigation';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { persistor, store } from './src/redux';
import './src/i18n'; // Initialize i18n

export default function App() {
  React.useEffect(() => {
    // Mirror chat_messaging config logging for quick environment diagnostics
    // Values come from .env / react-native-config
    // eslint-disable-next-line no-console
    console.log('ENVIRONMENT', Config.ENVIRONMENT);
    // eslint-disable-next-line no-console
    console.log('API_URL', Config.API_URL);
  }, []);

  return (
    <GestureHandlerRootView style={styles.flex1}>
      <SafeAreaProvider>
        <View style={styles.container}>
          <Provider store={store}>
            <PersistGate loading={null} persistor={persistor}>
              <AppNavigation />
            </PersistGate>
          </Provider>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
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
});
