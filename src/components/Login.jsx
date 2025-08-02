import { useState } from 'react'
import { signIn, signUp } from '../utils/auth.js'

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
    let result
    if (isSignUp) {
      result = await signUp(email, password)
    } else {
      result = await signIn(email, password)
    }
    const { data, error: err } = result
    if (err) {
      setError(err.message)
    } else {
      onLogin?.(data.session)
    }
  }

  return (
    <div className="login">
      <h1>{isSignUp ? 'Sign Up' : 'Login'}</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">{isSignUp ? 'Sign Up' : 'Sign In'}</button>
      </form>
      <button
        type="button"
        onClick={() => setIsSignUp((s) => !s)}
      >
        {isSignUp ? 'Have an account? Sign In' : 'Need an account? Sign Up'}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
