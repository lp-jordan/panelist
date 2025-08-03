import { useState } from 'react'
import { signIn, signUp } from '../utils/auth.js'
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

    let result
    try {
      if (isSignUp) {
        result = await signUp(trimmedEmail, trimmedPassword)
      } else {
        result = await signIn(trimmedEmail, trimmedPassword)
      }
    } catch (err) {
      console.error('Unexpected auth error:', err)
      setError(err.message)
      return
    }

    const { data, error: err } = result
    if (err) {
      console.error('Auth error:', err)
      setError(err.message)
    } else {
      onLogin?.(data.session)
    }
  }

  return (
    <div className="mx-auto mt-20 max-w-sm space-y-4">
      <h1 className="text-center text-2xl font-bold">
        {isSignUp ? 'Sign Up' : 'Login'}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md bg-zinc-800 p-2 text-zinc-100 focus:outline-none"
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md bg-zinc-800 p-2 text-zinc-100 focus:outline-none"
        />
        <Button type="submit" className="w-full">
          {isSignUp ? 'Sign Up' : 'Sign In'}
        </Button>
      </form>
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => setIsSignUp((s) => !s)}
      >
        {isSignUp ? 'Have an account? Sign In' : 'Need an account? Sign Up'}
      </Button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
