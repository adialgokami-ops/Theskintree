import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_BOOKING_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_BOOKING_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
})

const AuthContext = createContext(null)

const IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [staff, setStaff] = useState(null)
  const [loading, setLoading] = useState(true)

  // MFA challenge state
  const [mfaChallenge, setMfaChallenge] = useState(null) // { factorId, challengeId }

  const idleTimerRef = useRef(null)

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } catch (_) {}
    setSession(null)
    setUser(null)
    setStaff(null)
    setMfaChallenge(null)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
  }, [])

  // Fetch staff profile from /api/me using bearer token
  const fetchStaffProfile = useCallback(async (token) => {
    try {
      const res = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        throw new Error('Failed to load staff details')
      }
      const data = await res.json()
      setStaff(data.staff)
      return data.staff
    } catch (err) {
      console.error('fetchStaffProfile error:', err)
      return null
    }
  }, [])

  // Auto-logout on 30-min idle
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (session) {
      idleTimerRef.current = setTimeout(() => {
        alert('You have been logged out due to 30 minutes of inactivity for medical security compliance.')
        logout()
      }, IDLE_TIMEOUT_MS)
    }
  }, [session, logout])

  useEffect(() => {
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
    const handleActivity = () => resetIdleTimer()

    activityEvents.forEach((ev) => window.addEventListener(ev, handleActivity))
    resetIdleTimer()

    return () => {
      activityEvents.forEach((ev) => window.removeEventListener(ev, handleActivity))
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [resetIdleTimer])

  // Check initial session
  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!mounted) return
      if (initialSession) {
        setSession(initialSession)
        setUser(initialSession.user)
        await fetchStaffProfile(initialSession.access_token)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return
      setSession(currentSession)
      setUser(currentSession?.user || null)
      if (currentSession?.access_token) {
        await fetchStaffProfile(currentSession.access_token)
      } else {
        setStaff(null)
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchStaffProfile])

  // Sign in with email and password
  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    // Check MFA status
    const factorsRes = await supabase.auth.mfa.listFactors()
    const verifiedTotp = factorsRes.data?.totp?.find((f) => f.status === 'verified')

    if (verifiedTotp) {
      // Create MFA challenge
      const challenge = await supabase.auth.mfa.challenge({ factorId: verifiedTotp.id })
      if (challenge.error) throw challenge.error
      setMfaChallenge({ factorId: verifiedTotp.id, challengeId: challenge.data.id })
      return { mfaRequired: true }
    }

    // No TOTP enrolled; load staff profile directly
    if (data.session) {
      await fetchStaffProfile(data.session.access_token)
    }
    return { mfaRequired: false }
  }

  // Verify TOTP challenge
  const verifyMfa = async (code) => {
    if (!mfaChallenge) throw new Error('No active MFA challenge.')
    const { data, error } = await supabase.auth.mfa.verify({
      factorId: mfaChallenge.factorId,
      challengeId: mfaChallenge.challengeId,
      code
    })
    if (error) throw error

    setMfaChallenge(null)
    const { data: refreshed } = await supabase.auth.getSession()
    if (refreshed?.session) {
      setSession(refreshed.session)
      await fetchStaffProfile(refreshed.session.access_token)
    }
    return data
  }

  // Enroll TOTP (for new staff setup)
  const enrollTotp = async () => {
    const res = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      issuer: 'The Skin Tree'
    })
    if (res.error) throw res.error
    return res.data
  }

  // Authenticated fetch wrapper for calling /api/*
  const authFetch = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }

    const res = await fetch(url, { ...options, headers })
    if (res.status === 401) {
      logout()
      throw new Error('Session expired or unauthorized. Please log in again.')
    }
    return res
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        staff,
        loading,
        mfaChallenge,
        login,
        verifyMfa,
        enrollTotp,
        logout,
        authFetch
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
