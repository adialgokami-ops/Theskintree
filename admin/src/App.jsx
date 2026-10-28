import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Schedule from './pages/Schedule'
import Patients from './pages/Patients'
import PatientDetail from './pages/PatientDetail'
import Reminders from './pages/Reminders'
import StaffManage from './pages/StaffManage'
import AuditLog from './pages/AuditLog'

function ProtectedRoute({ children, allowedRoles = null }) {
  const { session, staff, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <div style={{ textAlign: 'center', color: 'var(--color-forest)' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>THE SKIN TREE</h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Verifying credentials...</div>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && staff && !allowedRoles.includes(staff.role)) {
    return (
      <div className="admin-layout">
        <Navbar />
        <div className="admin-content" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛑</div>
          <h2 style={{ fontSize: '1.5rem', color: 'var(--color-forest)', marginBottom: '0.5rem' }}>
            Access Restricted
          </h2>
          <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
            Your account role ({staff.role}) does not have permission to access this management module.
          </p>
          <a href="/schedule" className="btn-primary" style={{ display: 'inline-flex' }}>
            ← Return to Schedule
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-layout">
      <Navbar />
      {children}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/schedule"
          element={
            <ProtectedRoute>
              <Schedule />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients"
          element={
            <ProtectedRoute>
              <Patients />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:ref"
          element={
            <ProtectedRoute>
              <PatientDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reminders"
          element={
            <ProtectedRoute>
              <Reminders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <StaffManage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AuditLog />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/schedule" replace />} />
      </Routes>
    </AuthProvider>
  )
}
