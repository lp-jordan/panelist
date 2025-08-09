import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import App from './App.jsx'
import Login from './components/Login.jsx'
import './index.css'
import { supabase } from './utils/supabaseClient.js'

function Root() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      console.log('Initial auth session:', data.session)
      setSession(data.session)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session)
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (!session) {
    return <Login onLogin={(s) => {
      console.log('Login successful, session set')
      setSession(s)
    }} />
  }

  return <App onSignOut={() => {
    console.log('User signed out from App')
    setSession(null)
  }} />
}

export default Root

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
