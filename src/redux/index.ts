import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
import { RootState, AppDispatch } from './store';

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Export store and persistor
export { store, persistor } from './store';
export type { RootState, AppDispatch } from './store';

// Export all actions from reducers
export * from './reducers';

// Export selectors for optimized re-renders
export * from './selectors';

// Export types
export * from './types';
