// =============================================================================
// Layout.tsx — Main application shell (navbar + sidebar + content area)
// Implements: REQ-UI-01 (navigation layout), REQ-SEC-02 (logout button)
// =============================================================================

import { Outlet, NavLink, useNavigate } from 'react-router';
import { useAuth } from '../hooks/useAuth.js';

/** Navigation items for the sidebar. */
const NAV_ITEMS = [
  { path: '/', label: 'Dashboard' },
  { path: '/patients', label: 'Patients' },
  { path: '/appointments', label: 'Appointments' },
  { path: '/sales', label: 'Sales' },
  { path: '/inventory', label: 'Inventory' },
  { path: '/settings', label: 'Settings' },
] as const;

/** Renders a single sidebar nav link with active styling. */
function NavItem({ path, label }: { path: string; label: string }) {
  return (
    <NavLink
      to={path}
      end={path === '/'}
      className={({ isActive }) =>
        `nav-item${isActive ? ' nav-item--active' : ''}`
      }
    >
      {label}
    </NavLink>
  );
}

/**
 * Main layout component providing the app shell.
 * Includes top navbar with branding/logout and a sidebar
 * with navigation links. Content renders via <Outlet />.
 */
export function Layout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  /** Handle logout — clears session and redirects to login. */
  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="layout">
      <header className="layout__navbar">
        <span className="layout__brand">Zenoti Analytics</span>
        <button
          data-testid="logout"
          className="layout__logout"
          onClick={handleLogout}
        >
          Logout
        </button>
      </header>
      <aside className="layout__sidebar">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.path} path={item.path} label={item.label} />
        ))}
      </aside>
      <main className="layout__content">
        <Outlet />
      </main>
    </div>
  );
}
