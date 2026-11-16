import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { currentUserId } from '../lib/resources'
import AppBar from '../components/AppBar'
import ResourcePicker from '../components/ResourcePicker'
import SessionForm from '../components/SessionForm'
import styles from '../styles/page.module.css'

// Creates a standalone reading session (no study). It can be added to a study
// on the same PDF later.
export default function SessionNewPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [resourceIds, setResourceIds] = useState(params.get('resource') ? [params.get('resource')] : [])
  const [outline, setOutline] = useState(null) // null while loading the selected resource
  const resourceId = resourceIds[0]

  useEffect(() => {
    if (!resourceId) return
    setOutline(null)
    supabase.from('resources').select('outline').eq('id', resourceId).single()
      .then(({ data }) => setOutline(data?.outline ?? []))
  }, [resourceId])

  const create = async (values) => {
    const user_id = await currentUserId(supabase)
    const { data, error } = await supabase
      .from('reading_sessions')
      .insert({ ...values, user_id, resource_id: resourceId, study_id: null })
      .select('id')
      .single()
    if (error) throw error
    navigate(`/session/${data.id}`)
  }

  return (
    <div className={styles.root}>
      <AppBar crumbs={[{ label: 'New reading session' }]} />
      <main className={`${styles.main} ${styles.narrow}`}>
        <div className={styles.field}>
          <label className={styles.label}>Document</label>
          <ResourcePicker value={resourceIds} onChange={setResourceIds} />
        </div>
        {resourceId && (
          <div className={styles.field}>
            <label className={styles.label}>Reading range</label>
            {outline === null
              ? <p className={styles.hint}>Loading sections…</p>
              : <SessionForm key={resourceId} outline={outline} onSubmit={create} submitLabel="Create session" />}
          </div>
        )}
      </main>
    </div>
  )
}
