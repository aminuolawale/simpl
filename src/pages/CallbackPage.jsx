import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function CallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const code = new URL(window.location.href).searchParams.get('code')

    const finish = async () => {
      if (code) await supabase.auth.exchangeCodeForSession(code)
      navigate('/', { replace: true })
    }

    finish()
  }, [navigate])

  return null
}
