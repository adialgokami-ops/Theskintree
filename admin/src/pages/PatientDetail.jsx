import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function PatientDetail() {
  const { ref: patientRef } = useParams()
  const navigate = useNavigate()
  const { authFetch, staff } = useAuth()

  const [contactData, setContactData] = useState(null)
  const [clinicalData, setClinicalData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Active tab
  const [activeTab, setActiveTab] = useState('clinical') // 'clinical' or 'bookings'

  // Modals state
  const [editProfileModal, setEditProfileModal] = useState(false)
  const [newConsultModal, setNewConsultModal] = useState(false)
  const [newMedModal, setNewMedModal] = useState(false)
  const [eraseModal, setEraseModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Forms state
  const [profileForm, setProfileForm] = useState({
    skin_type: 'III',
    allergies: '',
    medical_history: '',
    emergency_contact: '',
    notes: '',
    date_of_birth: '',
    gender: 'unspecified'
  })

  const [consultForm, setConsultForm] = useState({
    chief_complaint: '',
    examination_findings: '',
    diagnosis: '',
    clinical_notes: '',
    plan: '',
    follow_up_date: ''
  })

  const [medForm, setMedForm] = useState({
    name: '',
    dosage: '',
    frequency: '',
    duration_days: 14,
    instructions: ''
  })

  const isDoctorOrAdmin = ['admin', 'doctor'].includes(staff?.role)

  const loadPatient = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Load contact + booking history (all staff)
      const cRes = await authFetch(`/api/contacts/${patientRef}`)
      const cJson = await cRes.json()
      if (!cRes.ok) throw new Error(cJson.error || 'Failed to load contact data.')
      setContactData(cJson)

      // 2. Load clinical records (Doctor & Admin only)
      if (isDoctorOrAdmin) {
        // Initialize profile if not existing
        await authFetch('/api/clinical/patients/open', {
          method: 'POST',
          body: JSON.stringify({ patient_ref: patientRef })
        })

        const clRes = await authFetch(`/api/clinical/patients/${patientRef}`)
        const clJson = await clRes.json()
        if (clRes.ok) {
          setClinicalData(clJson)
          if (clJson.profile) {
            setProfileForm({
              skin_type: clJson.profile.skin_type || 'III',
              allergies: clJson.profile.allergies || '',
              medical_history: clJson.profile.medical_history || '',
              emergency_contact: clJson.profile.emergency_contact || '',
              notes: clJson.profile.notes || '',
              date_of_birth: clJson.profile.date_of_birth || '',
              gender: clJson.profile.gender || 'unspecified'
            })
          }
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [authFetch, patientRef, isDoctorOrAdmin])

  useEffect(() => {
    loadPatient()
  }, [loadPatient])

  // Toggle Reminder Consent
  const handleToggleConsent = async () => {
    if (!contactData?.contact) return
    const currentVal = Boolean(contactData.contact.reminder_consent)
    try {
      const res = await authFetch(`/api/contacts/${patientRef}/consent`, {
        method: 'PATCH',
        body: JSON.stringify({ reminder_consent: !currentVal })
      })
      if (!res.ok) throw new Error('Failed to update consent')
      setContactData({
        ...contactData,
        contact: { ...contactData.contact, reminder_consent: !currentVal }
      })
    } catch (err) {
      alert(err.message)
    }
  }

  // Update Clinical Profile
  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    try {
      const res = await authFetch(`/api/clinical/patients/${patientRef}`, {
        method: 'PATCH',
        body: JSON.stringify(profileForm)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update clinical profile.')
      setClinicalData((prev) => ({ ...prev, profile: data.profile }))
      setEditProfileModal(false)
    } catch (err) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Add Consultation
  const handleConsultSubmit = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    try {
      const res = await authFetch('/api/clinical/consultations', {
        method: 'POST',
        body: JSON.stringify({
          patient_ref: patientRef,
          ...consultForm
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to record consultation.')
      setClinicalData((prev) => ({
        ...prev,
        consultations: [data.consultation, ...(prev?.consultations || [])]
      }))
      setNewConsultModal(false)
      setConsultForm({
        chief_complaint: '',
        examination_findings: '',
        diagnosis: '',
        clinical_notes: '',
        plan: '',
        follow_up_date: ''
      })
    } catch (err) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Prescribe Medication
  const handleMedSubmit = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    try {
      const res = await authFetch('/api/clinical/medications', {
        method: 'POST',
        body: JSON.stringify({
          patient_ref: patientRef,
          ...medForm
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to record prescription.')
      setClinicalData((prev) => ({
        ...prev,
        medications: [data.medication, ...(prev?.medications || [])]
      }))
      setNewMedModal(false)
      setMedForm({
        name: '',
        dosage: '',
        frequency: '',
        duration_days: 14,
        instructions: ''
      })
    } catch (err) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Update Medication Status
  const handleUpdateMedStatus = async (medId, status) => {
    try {
      const res = await authFetch(`/api/clinical/medications/${medId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update medication status.')
      setClinicalData((prev) => ({
        ...prev,
        medications: (prev?.medications || []).map((m) => (m.id === medId ? data.medication : m))
      }))
    } catch (err) {
      alert(err.message)
    }
  }

  // Erase Patient (Admin Only - DPDP Compliance)
  const handleEraseConfirm = async () => {
    setActionLoading(true)
    try {
      const res = await authFetch(`/api/clinical/patients/${patientRef}/erase`, {
        method: 'POST'
      })
      if (!res.ok) throw new Error('Failed to erase patient records.')
      alert('Patient data successfully purged and contact record anonymized.')
      navigate('/patients')
    } catch (err) {
      alert(`Erasure failed: ${err.message}`)
    } finally {
      setActionLoading(false)
      setEraseModal(false)
    }
  }

  if (loading) {
    return (
      <div className="admin-content" style={{ textAlign: 'center', padding: '4rem 0' }}>
        Loading patient record...
      </div>
    )
  }

  if (error || !contactData?.contact) {
    return (
      <div className="admin-content">
        <div className="warning-box" style={{ background: '#FFF5F5', borderColor: '#FEB2B2', color: '#C53030' }}>
          {error || 'Patient contact record not found.'}
        </div>
        <button type="button" className="btn-secondary" onClick={() => navigate('/patients')}>
          ← Back to Directory
        </button>
      </div>
    )
  }

  const { contact, bookings } = contactData

  return (
    <div className="admin-content">
      {/* Patient Header Card */}
      <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h1 style={{ fontSize: '2rem' }}>{contact.full_name}</h1>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  background: contact.reminder_consent ? '#DEF7EC' : '#EDF2F7',
                  color: contact.reminder_consent ? '#03543F' : '#718096',
                  fontWeight: 600
                }}
              >
                {contact.reminder_consent ? '✓ Reminders Consented' : 'Reminders Disabled'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '8px', fontSize: '0.9rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
              <div>📞 <strong>Phone:</strong> {contact.phone}</div>
              <div>✉️ <strong>Email:</strong> {contact.email || 'N/A'}</div>
              <div>🔑 <strong>Ref UUID:</strong> <code style={{ fontSize: '0.8rem' }}>{contact.patient_ref}</code></div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="btn-secondary" onClick={handleToggleConsent}>
              {contact.reminder_consent ? 'Opt-Out of Reminders' : 'Enable Reminders'}
            </button>
            {staff?.role === 'admin' && (
              <button
                type="button"
                className="btn-danger"
                style={{ fontSize: '0.8rem' }}
                onClick={() => setEraseModal(true)}
              >
                🗑️ Erase Patient (DPDP)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '1.5rem' }}>
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
          🩺 Clinical Records & Chart
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bookings')}
          style={{
            padding: '0.75rem 1.5rem',
            fontWeight: 600,
            fontSize: '0.95rem',
            borderBottom: activeTab === 'bookings' ? '3px solid var(--color-forest)' : '3px solid transparent',
            color: activeTab === 'bookings' ? 'var(--color-forest)' : 'var(--color-text-muted)'
          }}
        >
          📅 Booking History ({bookings.length})
        </button>
      </div>

      {/* TAB 1: Doctor Medical Records & Chart */}
      {activeTab === 'clinical' && (
        <div>
          {!isDoctorOrAdmin ? (
            <div className="restriction-notice">
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔒</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--color-forest)' }}>
                Doctor-Confidential Medical Records
              </h3>
              <p style={{ maxWidth: '480px', margin: '0 auto', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Medical chart entries, diagnostic examination findings, and clinical prescriptions are restricted to licensed doctors and clinic administrators. Reception staff may only view scheduling details.
              </p>
            </div>
          ) : (
            <div>
              {/* Doctor Medical Chart Profile */}
              <div className="admin-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.25rem' }}>Clinical Profile & Demographics</h3>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    onClick={() => setEditProfileModal(true)}
                  >
                    ✏️ Edit Profile
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', fontSize: '0.9rem' }}>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.8rem' }}>Fitzpatrick Skin Type</span>
                    <strong style={{ fontSize: '1rem', color: 'var(--color-forest)' }}>
                      Type {clinicalData?.profile?.skin_type || 'Unspecified'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.8rem' }}>Known Allergies</span>
                    <strong style={{ color: clinicalData?.profile?.allergies ? '#C53030' : 'inherit' }}>
                      {clinicalData?.profile?.allergies || 'No known allergies reported'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.8rem' }}>Emergency Contact</span>
                    <strong>{clinicalData?.profile?.emergency_contact || 'None listed'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.8rem' }}>Gender & DOB</span>
                    <strong>
                      {clinicalData?.profile?.gender || 'Unspecified'} • {clinicalData?.profile?.date_of_birth || 'DOB not provided'}
                    </strong>
                  </div>
                </div>

                {clinicalData?.profile?.medical_history && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #EDF2F7', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>
                      Medical History Notes
                    </span>
                    <p style={{ background: '#F8FAF8', padding: '0.75rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                      {clinicalData.profile.medical_history}
                    </p>
                  </div>
                )}
              </div>

              {/* Consultations Timeline */}
              <div className="admin-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem' }}>Doctor Consultations</h3>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                      Diagnoses and clinical treatment protocols curated by Dr. Aishwarya.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ fontSize: '0.85rem' }}
                    onClick={() => setNewConsultModal(true)}
                  >
                    + New Consultation Note
                  </button>
                </div>

                {(!clinicalData?.consultations || clinicalData.consultations.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-text-muted)' }}>
                    No consultation notes recorded yet for this patient.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {clinicalData.consultations.map((c) => (
                      <div
                        key={c.id}
                        style={{
                          border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                          padding: '1.25rem',
                          background: '#FFFFFF'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #EDF2F7', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                          <div>
                            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-gold)', fontWeight: 600 }}>
                              Consultation Date
                            </span>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-forest)' }}>
                              {c.consultation_date}
                            </div>
                          </div>
                          {c.follow_up_date && (
                            <span style={{ fontSize: '0.8rem', background: '#FEF3C7', color: '#92400E', padding: '0.2rem 0.6rem', borderRadius: '999px', fontWeight: 600 }}>
                              Follow-Up Due: {c.follow_up_date}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div>
                            <strong>Chief Complaint:</strong> {c.chief_complaint}
                          </div>
                          {c.diagnosis && (
                            <div>
                              <strong style={{ color: 'var(--color-forest)' }}>Diagnosis:</strong> {c.diagnosis}
                            </div>
                          )}
                          {c.examination_findings && (
                            <div>
                              <span style={{ color: '#718096', fontSize: '0.85rem' }}>Examination:</span> {c.examination_findings}
                            </div>
                          )}
                          {c.clinical_notes && (
                            <div style={{ background: '#F8FAF8', padding: '0.5rem 0.75rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                              <strong>Notes:</strong> {c.clinical_notes}
                            </div>
                          )}
                          {c.plan && (
                            <div>
                              <strong style={{ color: 'var(--color-forest)' }}>Treatment Plan:</strong> {c.plan}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Prescriptions & Medications */}
              <div className="admin-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem' }}>Prescriptions & Regimens</h3>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                      Clinical pharmaceuticals and medical topicals prescribed by Dr. Aishwarya.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ fontSize: '0.85rem' }}
                    onClick={() => setNewMedModal(true)}
                  >
                    + Prescribe Medicine
                  </button>
                </div>

                {(!clinicalData?.medications || clinicalData.medications.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-text-muted)' }}>
                    No medications prescribed for this patient.
                  </div>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Medication</th>
                        <th>Dosage</th>
                        <th>Frequency</th>
                        <th>Duration</th>
                        <th>Instructions</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clinicalData.medications.map((m) => (
                        <tr key={m.id}>
                          <td style={{ fontWeight: 600, color: 'var(--color-forest)' }}>{m.name}</td>
                          <td>{m.dosage}</td>
                          <td>{m.frequency}</td>
                          <td>{m.duration_days ? `${m.duration_days} days` : 'Ongoing'}</td>
                          <td style={{ fontSize: '0.85rem', color: '#4A5568' }}>{m.instructions || 'As directed'}</td>
                          <td>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '999px',
                                textTransform: 'capitalize',
                                fontWeight: 600,
                                background: m.status === 'active' ? '#DEF7EC' : m.status === 'completed' ? '#EDF2F7' : '#FDE8E8',
                                color: m.status === 'active' ? '#03543F' : m.status === 'completed' ? '#4A5568' : '#9B1C1C'
                              }}
                            >
                              {m.status}
                            </span>
                          </td>
                          <td>
                            {m.status === 'active' ? (
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                onClick={() => handleUpdateMedStatus(m.id, 'completed')}
                              >
                                Mark Done
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                onClick={() => handleUpdateMedStatus(m.id, 'active')}
                              >
                                Reactivate
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BOOKING HISTORY */}
      {activeTab === 'bookings' && (
        <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
          {bookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>
              No appointments recorded for this patient.
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Treatment</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Patient Notes</th>
                  <th>Staff Internal Notes</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600 }}>
                      {b.slot_date} at {b.slot_time}
                    </td>
                    <td>{b.treatment}</td>
                    <td>
                      <span className={`status-pill ${b.status}`}>{b.status}</span>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.8rem' }}>{b.source}</code>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#4A5568' }}>{b.notes || '—'}</td>
                    <td style={{ fontSize: '0.85rem', color: '#4A5568' }}>{b.staff_notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Edit Clinical Profile Modal */}
      {editProfileModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title">Edit Clinical Profile</h3>
              <span className="modal-close" onClick={() => setEditProfileModal(false)}>✕</span>
            </div>
            <form onSubmit={handleProfileSubmit}>
              <div className="form-group">
                <label className="form-label">Fitzpatrick Skin Type</label>
                <select
                  className="form-select"
                  value={profileForm.skin_type}
                  onChange={(e) => setProfileForm({ ...profileForm, skin_type: e.target.value })}
                >
                  <option value="I">Type I (Pale white, burns always)</option>
                  <option value="II">Type II (White, burns usually)</option>
                  <option value="III">Type III (Light brown, burns mildly, tans uniformly)</option>
                  <option value="IV">Type IV (Moderate brown, rarely burns)</option>
                  <option value="V">Type V (Dark brown, very rarely burns)</option>
                  <option value="VI">Type VI (Deeply pigmented / black, never burns)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Known Allergies (Topical / Systemic)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Aspirin / Salicylic Acid / Fragrances"
                  value={profileForm.allergies}
                  onChange={(e) => setProfileForm({ ...profileForm, allergies: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Medical History Notes</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="e.g. History of keloids, melasma, PCOS, previous laser treatments..."
                  value={profileForm.medical_history}
                  onChange={(e) => setProfileForm({ ...profileForm, medical_history: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Emergency Contact Phone & Relation</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Kabir Roy (Spouse) +91 98200 54321"
                  value={profileForm.emergency_contact}
                  onChange={(e) => setProfileForm({ ...profileForm, emergency_contact: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setEditProfileModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Consultation Modal */}
      {newConsultModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title">New Consultation Record</h3>
              <span className="modal-close" onClick={() => setNewConsultModal(false)}>✕</span>
            </div>
            <form onSubmit={handleConsultSubmit}>
              <div className="form-group">
                <label className="form-label">Chief Complaint *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Persistent post-inflammatory hyperpigmentation on cheeks"
                  value={consultForm.chief_complaint}
                  onChange={(e) => setConsultForm({ ...consultForm, chief_complaint: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Clinical Examination Findings</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="e.g. Wood's lamp shows epidermal pigment deposition..."
                  value={consultForm.examination_findings}
                  onChange={(e) => setConsultForm({ ...consultForm, examination_findings: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Diagnosis</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Epidermal Melasma with PIH"
                  value={consultForm.diagnosis}
                  onChange={(e) => setConsultForm({ ...consultForm, diagnosis: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Treatment Plan / In-Clinic Protocol</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="e.g. 3 sessions of custom lactic-glycolic peel spaced 3 weeks apart"
                  value={consultForm.plan}
                  onChange={(e) => setConsultForm({ ...consultForm, plan: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Follow-Up Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={consultForm.follow_up_date}
                  onChange={(e) => setConsultForm({ ...consultForm, follow_up_date: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setNewConsultModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Save Consultation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Medication Modal */}
      {newMedModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title">Prescribe Medicine / Regimen</h3>
              <span className="modal-close" onClick={() => setNewMedModal(false)}>✕</span>
            </div>
            <form onSubmit={handleMedSubmit}>
              <div className="form-group">
                <label className="form-label">Medication Name *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Tretinoin Microsphere Gel / Azelaic Acid 20%"
                  value={medForm.name}
                  onChange={(e) => setMedForm({ ...medForm, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Dosage & Strength *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. 0.04% / 500mg"
                  value={medForm.dosage}
                  onChange={(e) => setMedForm({ ...medForm, dosage: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Frequency *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Once nightly before sleep"
                  value={medForm.frequency}
                  onChange={(e) => setMedForm({ ...medForm, frequency: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Duration (Days)</label>
                <input
                  type="number"
                  className="form-input"
                  value={medForm.duration_days}
                  onChange={(e) => setMedForm({ ...medForm, duration_days: parseInt(e.target.value, 10) || null })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Specific Instructions</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Apply pea-sized amount over dry skin; strict SPF 50 during daytime"
                  value={medForm.instructions}
                  onChange={(e) => setMedForm({ ...medForm, instructions: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setNewMedModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Prescribing...' : 'Confirm Prescription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Erase Patient Modal (Admin Only) */}
      {eraseModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: 'var(--color-danger)' }}>
                Purge Patient Data (Right-to-be-Forgotten)
              </h3>
              <span className="modal-close" onClick={() => setEraseModal(false)}>✕</span>
            </div>
            <div className="warning-box" style={{ background: '#FFF5F5', borderColor: '#FEB2B2', color: '#9B1C1C' }}>
              ⚠️ <strong>Irreversible Legal Action:</strong> Under DPDP / GDPR regulations, confirming this action will:
              <ul style={{ marginTop: '8px', paddingLeft: '1.25rem' }}>
                <li>Hard-delete all medical charts, diagnoses, and doctor consultations.</li>
                <li>Hard-delete all prescribed medications and reminder logs.</li>
                <li>Anonymize the contact identity in the scheduling database.</li>
                <li>Record an immutable erasure entry in the clinic audit log.</li>
              </ul>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button type="button" className="btn-secondary" onClick={() => setEraseModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleEraseConfirm}
                disabled={actionLoading}
              >
                {actionLoading ? 'Purging Records...' : 'Permanently Purge Patient Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
