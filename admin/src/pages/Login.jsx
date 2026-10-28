import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login, verifyMfa, mfaChallenge, enrollTotp } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Enrolling state
  const [enrolling, setEnrolling] = useState(false)
  const [enrollData, setEnrollData] = useState(null)

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await login(email, password)
      if (!res.mfaRequired) {
        navigate('/schedule')
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await verifyMfa(otpCode)
      navigate('/schedule')
    } catch (err) {
      setError(err.message || 'Invalid 6-digit authentication code.')
    } finally {
      setLoading(false)
    }
  }

  const handleStartEnroll = async () => {
    try {
      setLoading(true)
      const data = await enrollTotp()
      setEnrollData(data)
      setEnrolling(true)
    } catch (err) {
      setError(err.message || 'Failed to start MFA enrollment.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAF8', padding: '1.5rem' }}>
      <div style={{ maxWidth: '420px', width: '100%', background: '#FFFFFF', padding: '2.5rem', borderRadius: '12px', boxShadow: '0 10px 25px rgba(27, 59, 43, 0.08)', border: '1px solid #E2E8F0' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.8rem', color: '#1B3B2B', letterSpacing: '0.05em' }}>THE SKIN TREE</h1>
          <p style={{ color: '#C5A880', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '4px' }}>
            Clinical & Scheduling Management
          </p>
        </div>

        {error && (
          <div style={{ background: '#FFF5F5', color: '#C53030', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1.25rem', border: '1px solid #FEB2B2' }}>
            {error}
          </div>
        )}

        {!mfaChallenge && !enrolling && (
          <form onSubmit={handlePasswordSubmit}>
            <div className="form-group">
              <label className="form-label">Clinic Email Address</label>
              <input
                type="email"
                required
                className="form-input"
                placeholder="doctor@theskintree.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                required
                className="form-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }} disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign In to Portal'}
            </button>
          </form>
        )}

        {mfaChallenge && (
          <form onSubmit={handleOtpSubmit}>
            <div style={{ background: '#F0FFF4', border: '1px solid #C6F6D5', padding: '0.75rem', borderRadius: '6px', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#22543D' }}>
              🔒 <strong>Two-Factor Authentication (MFA)</strong>
              <div style={{ marginTop: '4px' }}>Enter the 6-digit verification code from your authenticator app (Google Authenticator, 1Password, etc.).</div>
            </div>

            <div className="form-group">
              <label className="form-label">6-Digit TOTP Code</label>
              <input
                type="text"
                maxLength={6}
                autoFocus
                required
                pattern="[0-9]{6}"
                className="form-input"
                style={{ textAlign: 'center', letterSpacing: '0.3em', fontSize: '1.4rem', fontWeight: 700 }}
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                disabled={loading}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading || otpCode.length !== 6}>
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
          </form>
        )}

        {enrolling && enrollData && (
          <div>
            <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#4A5568' }}>
              Scan this QR code with your authenticator app to set up mandatory 2-Factor Authentication:
            </div>
            <div style={{ textAlign: 'center', margin: '1rem 0' }}>
              <img src={enrollData.totp.qr_code} alt="TOTP QR Code" style={{ maxWidth: '180px', margin: '0 auto', display: 'block' }} />
              <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: '6px' }}>
                Secret: <code>{enrollData.totp.secret}</code>
              </div>
            </div>
            <button type="button" className="btn-secondary" style={{ width: '100%' }} onClick={() => setEnrolling(false)}>
              Back to Login
            </button>
          </div>
        )}

        <div style={{ marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid #E2E8F0', fontSize: '0.75rem', color: '#A0AEC0', textAlign: 'center' }}>
          Authorized Clinic Personnel Only • Strictly Confidential
        </div>
      </div>
    </div>
  )
}
