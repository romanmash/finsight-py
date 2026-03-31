import { AuthProvider } from '../auth/AuthProvider';
import { AppRouter } from './router';

export function App(): JSX.Element {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
