import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

export default function AuditLog() {
  const { authFetch } = useAuth()
  const [activeTab, setActiveTab] = useState('booking') // 'booking' | 'clinical'
  const [auditData, setAuditData] = useState({ bookingAudit: [], clinicalAudit: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadAudit = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/audit')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load audit logs.')
      setAuditData(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [authFetch])

  useEffect(() => {
    loadAudit()
  }, [loadAudit])

  return (
    <div className="admin-content">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.8rem' }}>Compliance & Access Audit Trail</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
          Immutable logs of all scheduling mutations and confidential clinical record accesses.
        </p>
      </div>

      {error && (
        <div className="warning-box" style={{ background: '#FFF5F5', borderColor: '#FEB2B2', color: '#C53030' }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('booking')}
          style={{
            padding: '0.75rem 1.5rem',
            fontWeight: 600,
            fontSize: '0.95rem',
            borderBottom: activeTab === 'booking' ? '3px solid var(--color-forest)' : '3px solid transparent',
            color: activeTab === 'booking' ? 'var(--color-forest)' : 'var(--color-text-muted)'
          }}
        >
          📅 Booking Database Audit ({auditData.bookingAudit?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('clinical')}
          style={{
            padding: '0.75rem 1.5rem',
            fontWeight: 600,
            fontSize: '0.95rem',
            borderBottom: activeTab === 'clinical' ? '3px solid var(--color-forest)' : '3px solid transparent',
            color: activeTab === 'clinical' ? 'var(--color-forest)' : 'var(--color-text-muted)'
          }}
        >
          🔒 Clinical Record Access Logs ({auditData.clinicalAudit?.length || 0})
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>
          Loading audit trails...
        </div>
      ) : activeTab === 'booking' ? (
        <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
          {auditData.bookingAudit.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>
              No booking audit entries recorded yet.
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Timestamp (IST)</th>
                  <th>Action</th>
                  <th>Staff ID</th>
                  <th>Target Type</th>
                  <th>Target ID</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditData.bookingAudit.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {new Date(a.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </td>
                    <td>
                      <code style={{ fontWeight: 600, color: 'var(--color-forest)' }}>{a.action}</code>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.75rem' }}>{a.staff_id || 'System'}</code>
                    </td>
                    <td>{a.target_type || '—'}</td>
                    <td>
                      <code style={{ fontSize: '0.75rem' }}>{a.target_id || '—'}</code>
                    </td>
                    <td style={{ fontSize: '0.75rem', fontFamily: 'monospace', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {JSON.stringify(a.details || {})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
          {auditData.clinicalAudit.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>
              No clinical access logs recorded yet.
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Timestamp (IST)</th>
                  <th>Action</th>
                  <th>Staff ID</th>
                  <th>Staff Role</th>
                  <th>Patient Ref</th>
                  <th>Resource</th>
                  <th>Metadata</th>
                </tr>
              </thead>
              <tbody>
                {auditData.clinicalAudit.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {new Date(c.accessed_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </td>
                    <td>
                      <code style={{ fontWeight: 600, color: '#C05621' }}>{c.action}</code>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.75rem' }}>{c.staff_id || 'System'}</code>
                    </td>
                    <td>
                      <span className={`role-badge ${c.staff_role}`}>{c.staff_role}</span>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.75rem' }}>{c.patient_ref}</code>
                    </td>
                    <td>{c.resource}</td>
                    <td style={{ fontSize: '0.75rem', fontFamily: 'monospace', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {JSON.stringify(c.metadata || {})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
