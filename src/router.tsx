// Route table. Public: home, login, signup.
// Protected onboarding routes declare the step they serve via `requires`.

import { createBrowserRouter } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ConsentPage from './pages/onboarding/ConsentPage';
import RolePage from './pages/onboarding/RolePage';
import ProfilePage from './pages/onboarding/ProfilePage';
import AppHomePage from './pages/AppHomePage';
import CreateTaskPage from './pages/CreateTaskPage';
import { ProtectedRoute } from './lib/protected-route';

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  {
    path: '/onboarding/consent',
    element: (
      <ProtectedRoute requires="consent">
        <ConsentPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/onboarding/role',
    element: (
      <ProtectedRoute requires="role">
        <RolePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/onboarding/profile',
    element: (
      <ProtectedRoute requires="profile">
        <ProfilePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/app',
    element: (
      <ProtectedRoute requires="ready">
        <AppHomePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/create-task',
    element: (
      <ProtectedRoute requires="ready">
        <CreateTaskPage />
      </ProtectedRoute>
    ),
  },
]);
