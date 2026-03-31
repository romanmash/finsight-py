import { Navigate, Outlet, RouterProvider, createBrowserRouter } from 'react-router-dom';

import { useAuth } from '../auth/AuthProvider';
import { LoginPage } from '../auth/LoginPage';
import { DashboardPage } from '../dashboard/DashboardPage';

function RequireAuth(): JSX.Element {
  const auth = useAuth();

  if (!auth.isReady) {
    return <main className="loading">Preparing session...</main>;
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function LoginRoute(): JSX.Element {
  const auth = useAuth();
  if (auth.isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <LoginPage
      error={auth.loginError}
      onLogin={async (email: string, password: string): Promise<void> => {
        await auth.login(email, password);
      }}
    />
  );
}

export function AppRouter(): JSX.Element {
  const router = createBrowserRouter([
    {
      path: '/login',
      element: <LoginRoute />
    },
    {
      path: '/',
      element: <RequireAuth />,
      children: [
        {
          index: true,
          element: <DashboardPage />
        }
      ]
    }
  ]);

  return <RouterProvider router={router} />;
}
