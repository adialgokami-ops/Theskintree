import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

export default function StaffManage() {
  const { authFetch } = useAuth()
  const [staffList, setStaffList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Invite modal
  const [inviteModal, setInviteModal] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('reception')
  const [password, setPassword] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const loadStaff = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/staff')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load staff list.')
      setStaffList(data.staff || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [authFetch])

  useEffect(() => {
    loadStaff()
  }, [loadStaff])

  const handleInviteSubmit = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    try {
      const res = await authFetch('/api/staff', {
        method: 'POST',
        body: JSON.stringify({ name, email, role, password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to invite staff.')
      setInviteModal(false)
      setName('')
      setEmail('')
      setPassword('')
      await loadStaff()
    } catch (err) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleActive = async (userId, currentActive) => {
    try {
      const res = await authFetch(`/api/staff/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !currentActive })
      })
      if (!res.ok) throw new Error('Failed to update staff status.')
      await loadStaff()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleChangeRole = async (userId, newRole) => {
    try {
      const res = await authFetch(`/api/staff/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole })
      })
      if (!res.ok) throw new Error('Failed to update staff role.')
      await loadStaff()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="admin-content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem' }}>Staff & Practitioner Management</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
            Manage clinic personnel, role authorizations, and cryptographic MFA credentials.
          </p>
        </div>

        <button type="button" className="btn-primary" onClick={() => setInviteModal(true)}>
          + Invite / Add Staff Member
        </button>
      </div>

      {error && (
        <div className="warning-box" style={{ background: '#FFF5F5', borderColor: '#FEB2B2', color: '#C53030' }}>
          {error}
        </div>
      )}

      <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>
            Loading staff roster...
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Personnel Name</th>
                <th>Email Address</th>
                <th>Clinic Role</th>
                <th>Status</th>
                <th>Added Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staffList.map((s) => (
                <tr key={s.user_id}>
                  <td style={{ fontWeight: 600, color: 'var(--color-forest)' }}>{s.name}</td>
                  <td>{s.email}</td>
                  <td>
                    <select
                      className="form-select"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', width: 'auto' }}
                      value={s.role}
                      onChange={(e) => handleChangeRole(s.user_id, e.target.value)}
                    >
                      <option value="admin">Administrator</option>
                      <option value="doctor">Lead Doctor</option>
                      <option value="reception">Reception / Scheduling</option>
                    </select>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '999px',
                        background: s.active ? '#DEF7EC' : '#FFF5F5',
                        color: s.active ? '#03543F' : '#C53030',
                        fontWeight: 600
                      }}
                    >
                      {s.active ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td>{new Date(s.created_at).toLocaleDateString('en-IN')}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                      onClick={() => handleToggleActive(s.user_id, s.active)}
                    >
                      {s.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invite Modal */}
      {inviteModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title">Invite / Add Staff Member</h3>
              <span className="modal-close" onClick={() => setInviteModal(false)}>✕</span>
            </div>
            <form onSubmit={handleInviteSubmit}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Dr. Aishwarya Agarwal"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input
                  type="email"
                  required
                  className="form-input"
                  placeholder="doctor@theskintree.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Clinic Role *</label>
                <select
                  className="form-select"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="doctor">Lead Doctor (Full Clinical + Scheduling Access)</option>
                  <option value="reception">Reception / Concierge (Scheduling Only)</option>
                  <option value="admin">Clinic Administrator (Full System Access)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Initial Password (Optional)</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Leave empty to send email invite"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setInviteModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
