import { useState } from 'react'
import { signIn, signUp } from '../utils/auth.js'
import { logger } from '../utils/logger.js'
import { Button } from './ui/button'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Email and password are required')
      return
    }

    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    if (!trimmedPassword || trimmedPassword.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    const result = isSignUp
      ? await signUp(trimmedEmail, trimmedPassword)
      : await signIn(trimmedEmail, trimmedPassword)

    const { data, error: err } = result
    if (err) {
      logger.error('Auth error:', err)
      setError(err.message)
    } else {
      onLogin?.(data.session)
    }
  }

  return (
    <div className="login-container">
      <h1 className="login-title">{isSignUp ? 'Sign Up' : 'Login'}</h1>
      <form onSubmit={handleSubmit} className="login-form">
        <input
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
        />
        <Button type="submit" className="full-width">
          {isSignUp ? 'Sign Up' : 'Sign In'}
        </Button>
      </form>
      <Button
        type="button"
        variant="ghost"
        className="full-width"
        onClick={() => setIsSignUp((s) => !s)}
      >
        {isSignUp ? 'Have an account? Sign In' : 'Need an account? Sign Up'}
      </Button>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
