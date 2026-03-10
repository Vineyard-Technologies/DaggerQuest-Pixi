import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { initializeApp } from 'firebase/app'
import { getAuth, applyActionCode, confirmPasswordReset } from 'firebase/auth'
import SEO from '../components/SEO'

const app = initializeApp({
  apiKey: "AIzaSyCgr0MjqE5kIQ5t1s9uhapOtRV5Hls0dWA",
  authDomain: "daggerquest-backend.firebaseapp.com",
  projectId: "daggerquest-backend",
})
const auth = getAuth(app)

const PASSWORD_CHECKS = [
  { key: 'length', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { key: 'upper', label: 'An uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'A lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { key: 'digit', label: 'A number', test: (p: string) => /[0-9]/.test(p) },
  { key: 'special', label: 'A special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

function VerifyEmail({ oobCode }: { oobCode: string }) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    applyActionCode(auth, oobCode)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [oobCode])

  return (
    <div className="auth-card">
      <img src="/images/logo.webp" alt="DaggerQuest" className="auth-logo" />
      <h1 className="auth-title">Email Verification</h1>
      {status === 'loading' && (
        <p className="auth-message">Verifying your email…</p>
      )}
      {status === 'success' && (
        <p className="auth-message">Your email has been verified! You may now sign in to DaggerQuest.</p>
      )}
      {status === 'error' && (
        <p className="auth-error">This verification link is invalid or has expired. Please sign in to request a new one.</p>
      )}
    </div>
  )
}

function ResetPassword({ oobCode }: { oobCode: string }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const allPassed = PASSWORD_CHECKS.every(({ test }) => test(password))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!allPassed) {
      setError('Please meet all password requirements.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      await confirmPasswordReset(auth, oobCode, password)
      setDone(true)
    } catch {
      setError('This reset link is invalid or has expired. Please request a new one.')
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-card">
      <img src="/images/logo.webp" alt="DaggerQuest" className="auth-logo" />
      <h1 className="auth-title">Reset Password</h1>
      {done ? (
        <p className="auth-message">Your password has been reset! You may now sign in with your new password.</p>
      ) : (
        <>
          <p className="auth-message">Enter your new password below.</p>
          {error && <p className="auth-error">{error}</p>}
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-password-reqs">
              Password must contain:
              <ul>
                {PASSWORD_CHECKS.map(({ key, label, test }) => (
                  <li key={key}>
                    <span className={test(password) ? 'req-pass' : 'req-fail'}>
                      {test(password) ? '✓' : '✗'}
                    </span>{' '}
                    {label}
                  </li>
                ))}
              </ul>
            </div>
            <input
              type="password"
              placeholder="New Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="auth-input"
            />
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="auth-input"
            />
            <button type="submit" disabled={submitting} className="auth-button">
              {submitting ? 'Resetting…' : 'Reset Password'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}

function AuthAction() {
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode')
  const oobCode = searchParams.get('oobCode')

  const isVerify = mode === 'verifyEmail' && oobCode
  const isReset = mode === 'resetPassword' && oobCode

  return (
    <>
      <SEO
        title="Account | DaggerQuest | Browser ARPG"
        description="Manage your DaggerQuest account — verify your email or reset your password."
        url="https://DaggerQuest.com/auth/action"
      />
      <main className="auth-action-container">
        {isVerify && <VerifyEmail oobCode={oobCode} />}
        {isReset && <ResetPassword oobCode={oobCode} />}
        {!isVerify && !isReset && (
          <div className="auth-card">
            <img src="/images/logo.webp" alt="DaggerQuest" className="auth-logo" />
            <h1 className="auth-title">Invalid Link</h1>
            <p className="auth-message">This link is invalid or has expired.</p>
          </div>
        )}
      </main>
    </>
  )
}

export default AuthAction
