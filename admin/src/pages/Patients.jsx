import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Patients() {
  const { authFetch } = useAuth()
  const [contacts, setContacts] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadContacts = useCallback(async (query = '') => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch(`/api/contacts?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load patients.')
      setContacts(data.contacts || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [authFetch])

  useEffect(() => {
    loadContacts()
  }, [loadContacts])

  const handleSearch = (e) => {
    e.preventDefault()
    loadContacts(search)
  }

  return (
    <div className="admin-content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem' }}>Patient Directory</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
            Unified scheduling directory with isolated clinical records.
          </p>
        </div>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', maxWidth: '400px', width: '100%' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn-primary" style={{ flexShrink: 0 }}>
            Search
          </button>
        </form>
      </div>

      {error && (
        <div className="warning-box" style={{ background: '#FFF5F5', borderColor: '#FEB2B2', color: '#C53030' }}>
          {error}
        </div>
      )}

      <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>
            Loading patient directory...
          </div>
        ) : contacts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>
            No patient contacts found matching your criteria.
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Patient Name</th>
                <th>Contact Phone</th>
                <th>Email</th>
                <th>Reminder Consent</th>
                <th>First Registered</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.patient_ref}>
                  <td>
                    <Link
                      to={`/patients/${c.patient_ref}`}
                      style={{ fontWeight: 600, color: 'var(--color-forest)', textDecoration: 'underline' }}
                    >
                      {c.full_name}
                    </Link>
                  </td>
                  <td>{c.phone}</td>
                  <td>{c.email || '—'}</td>
                  <td>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '999px',
                        background: c.reminder_consent ? '#DEF7EC' : '#EDF2F7',
                        color: c.reminder_consent ? '#03543F' : '#718096',
                        fontWeight: 600
                      }}
                    >
                      {c.reminder_consent ? '✓ Consented' : 'Opt-Out'}
                    </span>
                  </td>
                  <td>{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                  <td>
                    <Link
                      to={`/patients/${c.patient_ref}`}
                      className="btn-secondary"
                      style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', display: 'inline-block' }}
                    >
                      View Records →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
