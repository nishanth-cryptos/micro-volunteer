// Route table. Public: home, login, signup.
// Protected onboarding routes declare the step they serve via `requires`.

import { createBrowserRouter, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ConsentPage from './pages/onboarding/ConsentPage';
import RolePage from './pages/onboarding/RolePage';
import ProfilePage from './pages/onboarding/ProfilePage';
import SkillsPage from './pages/onboarding/SkillsPage';
import AppHomePage from './pages/AppHomePage';
import CreateTaskPage from './pages/CreateTaskPage';
import TaskDetailPage from './pages/TaskDetailPage';
import { ProtectedRoute } from './lib/protected-route';
import AdminDashboard from './pages/AdminDashboard';
import { YourRoutesPage } from './pages/YourRoutesPage';

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
    path: '/onboarding/skills',
    element: (
      <ProtectedRoute requires="skills">
        <SkillsPage />
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
    path: '/your-routes',
    element: (
      <ProtectedRoute requires="ready">
        <YourRoutesPage />
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
  {
    path: '/tasks/:taskId',
    element: (
      <ProtectedRoute requires="ready">
        <TaskDetailPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/app/tasks/:taskId',
    element: (
      <ProtectedRoute requires="ready">
        <TaskDetailPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin',
    element: (
      <ProtectedRoute requires="ready" requiresAdmin={true}>
        <AdminDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/app" replace />,
  },
]);

