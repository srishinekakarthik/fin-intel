import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { ProtectedLayout, PublicOnlyRoute } from './components/shared/ProtectedLayout';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import CompaniesPage from './pages/companies/CompaniesPage';
import CompanyDetailPage from './pages/companies/CompanyDetailPage';
import DocumentsPage from './pages/documents/DocumentsPage';
import ChatPage from './pages/chat/ChatPage';
import ReportsPage from './pages/reports/ReportsPage';
import AlertsPage from './pages/alerts/AlertsPage';
import { TeamPage } from './pages/Placeholders';

const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: '/login',    element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: <ProtectedLayout />,
    children: [
      { path: '/dashboard',     element: <DashboardPage /> },
      { path: '/companies',     element: <CompaniesPage /> },
      { path: '/companies/:id', element: <CompanyDetailPage /> },
      { path: '/documents',     element: <DocumentsPage /> },
      { path: '/chat',          element: <ChatPage /> },
      { path: '/reports',       element: <ReportsPage /> },
      { path: '/alerts',        element: <AlertsPage /> },
      { path: '/team',          element: <TeamPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
