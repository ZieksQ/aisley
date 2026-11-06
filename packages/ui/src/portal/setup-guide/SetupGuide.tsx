import { LuCheck, LuCircle, LuMinus, LuPlus } from 'react-icons/lu'
import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useGuidePreferences } from './useGuidePreferences'
import type { SetupGuideSnapshot, SetupGuideTask } from './types'
import './setup-guide.css'

type Props = {
  scope: string
  snapshot: SetupGuideSnapshot | null
  tasks: SetupGuideTask[]
  loading: boolean
  error: boolean
  onRetry: () => void
  renderLink: (link: { label: string; to: string }) => ReactNode
}

export function SetupGuide(props: Props) {
  if (!props.snapshot) return <section className="setup-guide-status" aria-label="Setup guide">
    {props.loading ? <p role="status">Loading setup guide…</p> : <>
      <p role="status">The setup guide could not be loaded.</p>
      <button className="portal-button" onClick={props.onRetry} type="button">Retry setup guide</button>
    </>}
  </section>
  return <LoadedGuide key={`${props.scope}:${props.snapshot.tenant_id}:${props.snapshot.version}`} {...props} snapshot={props.snapshot} />
}

function LoadedGuide({ scope, snapshot, tasks, loading, error, onRetry, renderLink }: Props & { snapshot: SetupGuideSnapshot }) {
  const preferences = useGuidePreferences(`aisley:setup-guide:${scope}:${snapshot.tenant_id ?? 'none'}:v${snapshot.version}`, snapshot.auto_show)
  const [selected, setSelected] = useState(tasks[0].id)
  const headingId = useId()
  const reopen = useRef<HTMLButtonElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const complete = (task: SetupGuideTask) => task.automatic
    ? snapshot.automatic[task.id] === 'complete'
    : preferences.understood.includes(task.id)
  const count = tasks.filter(complete).length
  const percent = Math.round(count / tasks.length * 100)
  const allComplete = count === tasks.length
  const finish = preferences.finish
  const completedThisVisit = useRef(false)
  useEffect(() => {
    if (allComplete && !completedThisVisit.current) {
      completedThisVisit.current = true
      finish()
    }
    if (!allComplete) completedThisVisit.current = false
  }, [allComplete, finish])

  function visibility(next: boolean) {
    preferences.show(next)
    requestAnimationFrame(() => (next ? heading.current : reopen.current)?.focus())
  }

  function detail(task: SetupGuideTask) {
    const unavailable = task.automatic && (!snapshot.automatic[task.id] || snapshot.automatic[task.id] === 'unavailable')
    return <div className="setup-guide-detail" id={`${headingId}-${task.id}-detail`}>
      <h4>{task.title}</h4>
      <p className="setup-guide-location">Find it: {task.location}</p>
      <p>{task.description}</p>
      {task.automatic ? <p className="setup-guide-note">{unavailable
        ? 'This setup check is unavailable. Refresh the guide to try again.'
        : 'Checked automatically from your saved setup. Return to Dashboard to update progress.'}</p> :
        <label className="setup-guide-check"><input checked={complete(task)} onChange={() => preferences.toggle(task.id)} type="checkbox" />Mark as understood</label>}
      <div className="setup-guide-links">{task.links.map(link => <span key={link.to}>{renderLink(link)}</span>)}</div>
    </div>
  }

  return <section className="setup-guide" aria-labelledby={headingId}>
    <div className="setup-guide-toolbar">
      <div><h3 id={headingId} ref={heading} tabIndex={-1}>Get started</h3><p>Set up your workspace and learn where everyday tasks live.</p></div>
      <button className="portal-button" onClick={() => visibility(!preferences.visible)} ref={reopen} type="button" aria-expanded={preferences.visible}>
        {preferences.visible ? 'Hide setup guide' : 'Show setup guide'}
      </button>
    </div>
    {preferences.visible ? <>
      <div className="setup-guide-progress">
        <p aria-live="polite">{count} of {tasks.length} complete <span>{percent}%</span></p>
        <progress aria-label="Setup guide progress" max={tasks.length} value={count} />
        <p className="setup-guide-note">{preferences.memoryOnly ? 'Browser storage is unavailable. Lesson progress is saved for this visit.' : 'Lesson progress and visibility are saved in this browser.'}</p>
      </div>
      {allComplete ? <p className="setup-guide-success" role="status">You’ve completed the guide. You can return here whenever you need a reminder.</p> : null}
      {error || Object.values(snapshot.automatic).includes('unavailable') ? <div className="setup-guide-status" role="status"><p>{error ? 'Setup checks could not refresh. Showing the last loaded progress.' : 'Some setup checks are unavailable.'}</p><button className="portal-button" disabled={loading} onClick={onRetry} type="button">Retry setup guide</button></div> : null}
      <div className="setup-guide-workspace">
        <ul className="setup-guide-tasks">
          {tasks.map(task => <li key={task.id}>
            <button aria-controls={`${headingId}-${task.id}-detail`} aria-expanded={selected === task.id} className="setup-guide-task" onClick={() => setSelected(task.id)} type="button">
              <span className="setup-guide-mark" aria-hidden="true">{complete(task) ? <LuCheck size={18} /> : <LuCircle size={18} />}</span>
              <span><strong>{task.title}</strong><span>{complete(task) ? 'Complete' : task.automatic ? (snapshot.automatic[task.id] === 'incomplete' ? 'Setup task' : 'Check unavailable') : 'Navigation lesson'}</span></span>
              <span aria-hidden="true">{selected === task.id ? <LuMinus size={16} /> : <LuPlus size={16} />}</span>
            </button>
            {selected === task.id ? detail(task) : null}
          </li>)}
        </ul>
      </div>
      <div className="setup-guide-footer"><span>{loading ? 'Refreshing setup checks…' : `Setup checked ${new Date(snapshot.generated_at).toLocaleString()}`}</span><button className="portal-button" disabled={loading} onClick={onRetry} type="button">Refresh setup checks</button></div>
    </> : null}
  </section>
}
