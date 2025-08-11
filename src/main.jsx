import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import App from './App.jsx'
import Login from './components/Login.jsx'
import './index.css'
import {
  setCachedUserId,
  clearCachedUserId,
} from './utils/authCache.js'
function Root() {
  const [session, setSession] = useState(null)
  const [supabase, setSupabase] = useState(null)
  const [initError, setInitError] = useState(null)

  useEffect(() => {
    let subscription
    import('./utils/supabaseClient.js')
      .then(({ supabase }) => {
        setSupabase(supabase)
        supabase.auth.getSession().then(({ data }) => {
          console.log('Initial auth session:', data.session)
          setSession(data.session)
          const id = data.session?.user?.id
          if (id) setCachedUserId(id)
          else clearCachedUserId()
        })
        subscription = supabase.auth
          .onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event, session)
            setSession(session)
            const id = session?.user?.id
            if (id) setCachedUserId(id)
            else clearCachedUserId()
          })
          .data.subscription
      })
      .catch((error) => {
        console.error('Error initializing Supabase client:', error?.message || error)
        setInitError(error)
      })
    return () => subscription?.unsubscribe()
  }, [])

    if (initError) {
      return <div className="error">{initError.message || 'Supabase client failed to load'}</div>
    }

    if (!supabase) {
      return <div>Loading...</div>
    }

    if (!session) {
      return (
        <Login
          onLogin={(s) => {
            console.log('Login successful, session set')
            setSession(s)
            const id = s?.user?.id
            if (id) setCachedUserId(id)
          }}
        />
      )
    }

    return (
      <App
        onSignOut={() => {
          console.log('User signed out from App')
          setSession(null)
          clearCachedUserId()
        }}
        supabase={supabase}
      />
    )
}

export default Root

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
