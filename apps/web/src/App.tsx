// =============================================================================
// App.tsx — Root component with client-side routing
// Implements: REQ-UI-01 (SPA routing), REQ-SEC-02 (auth-gated routes)
// =============================================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { Layout } from './components/Layout.js';
import { useAuth } from './hooks/useAuth.js';
import { Login } from './pages/Login.js';
import { Dashboard } from './pages/Dashboard.js';
import { Patients } from './pages/Patients.js';
import { Appointments } from './pages/Appointments.js';
import { Sales } from './pages/Sales.js';
import { Inventory } from './pages/Inventory.js';
import { Settings } from './pages/Settings.js';

/** Protected route wrapper — redirects to /login if no session. */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

/**
 * Root application component.
 * Sets up React Router with protected and public routes.
 * All dashboard routes require authentication (REQ-SEC-02).
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />

        {/* Protected routes inside Layout shell */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="patients" element={<Patients />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="sales" element={<Sales />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
