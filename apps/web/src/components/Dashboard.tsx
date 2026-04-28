// =============================================================================
// Dashboard.tsx — Dashboard grid layout for KPI cards
// Implements: REQ-UI-01 (dashboard layout component)
// =============================================================================

import { ReactNode } from 'react';

interface DashboardProps {
  children: ReactNode;
  title?: string;
}

/**
 * Dashboard grid layout component.
 * Renders a responsive grid of KPI cards or report sections.
 * Provides optional title header above the grid.
 *
 * @param children — KPI cards or report widgets to lay out
 * @param title — Optional section title
 */
export function Dashboard({ children, title }: DashboardProps) {
  return (
    <div className="dashboard">
      {title && <h2 className="dashboard__title">{title}</h2>}
      <div className="dashboard__grid">
        {children}
      </div>
    </div>
  );
}
