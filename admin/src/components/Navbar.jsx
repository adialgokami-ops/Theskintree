import React from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, staff, logout } = useAuth()

  return (
    <header className="admin-header">
      <div className="admin-brand">
        <div>
          <h2 className="admin-brand-title">THE SKIN TREE</h2>
          <div className="admin-brand-tag">Clinical & Scheduling Portal</div>
        </div>
      </div>

      <nav className="admin-nav">
        <NavLink
          to="/schedule"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          📅 Schedule
        </NavLink>
        <NavLink
          to="/patients"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          👥 Patients
        </NavLink>
        <NavLink
          to="/reminders"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          🔔 Reminders
        </NavLink>

        {staff?.role === 'admin' && (
          <>
            <NavLink
              to="/staff"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              🛡️ Staff
            </NavLink>
            <NavLink
              to="/audit"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              📜 Audit
            </NavLink>
          </>
        )}
      </nav>

      <div className="admin-user-bar">
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-forest)' }}>
            {staff?.name || user?.email || 'Staff'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end', marginTop: '2px' }}>
            <span className={`role-badge ${staff?.role || 'reception'}`}>
              {staff?.role || 'staff'}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#A0AEC0' }} title="30-minute idle auto-logout">
              • 30m idle
            </span>
          </div>
        </div>

        <button type="button" className="btn-signout" onClick={logout}>
          Sign Out
        </button>
      </div>
    </header>
  )
}
