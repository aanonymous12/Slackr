'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Calendar, Flag, User, Check, Clock, Circle, Trash2, ChevronDown } from 'lucide-react'

type Status = 'not_started' | 'in_progress' | 'completed'
type Priority = 'low' | 'medium' | 'high'

interface Task {
  id: string
  title: string
  description: string | null
  status: Status
  priority: Priority
  due_date: string | null
  created_by: string
  assigned_to: string | null
  created_at: string
  created_by_profile: { id: string; full_name: string; username: string } | null
  assigned_to_profile: { id: string; full_name: string; username: string } | null
}

interface Props {
  workspaceId: string
  currentUserId: string
  members: Record<string, unknown>[]
}

const COLUMNS: { key: Status; label: string; color: string; bg: string; icon: React.ReactNode }[] = [
  { key: 'not_started', label: 'Not Started', color: '#72767d', bg: 'rgba(114,118,125,0.1)', icon: <Circle size={14} /> },
  { key: 'in_progress', label: 'In Progress', color: '#faa61a', bg: 'rgba(250,166,26,0.1)', icon: <Clock size={14} /> },
  { key: 'completed',   label: 'Completed',   color: '#2eb67d', bg: 'rgba(46,182,125,0.1)',  icon: <Check size={14} /> },
]

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string }> = {
  low:    { label: 'Low',    color: '#72767d' },
  medium: { label: 'Medium', color: '#faa61a' },
  high:   { label: 'High',   color: '#ed4245' },
}

export default function TaskBoard({ workspaceId, currentUserId, members }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [filter, setFilter] = useState<'all' | Status>('all')
  const supabase = createClient()

  // Form state
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium' as Priority,
    due_date: '', assigned_to: '',
  })

  useEffect(() => { loadTasks() }, [workspaceId])

  // Realtime subscription
  useEffect(() => {
    const sub = supabase.channel(`tasks-${workspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks',
        filter: `workspace_id=eq.${workspaceId}` },
        () => loadTasks()
      ).subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [workspaceId])

  async function loadTasks() {
    const res = await fetch(`/api/tasks?workspace_id=${workspaceId}`)
    const data = await res.json()
    if (data.tasks) setTasks(data.tasks)
    setLoading(false)
  }

  async function createTask() {
    if (!form.title.trim()) return
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: workspaceId,
        title: form.title.trim(),
        description: form.description || null,
        priority: form.priority,
        due_date: form.due_date || null,
        assigned_to: form.assigned_to || null,
      }),
    })
    const data = await res.json()
    if (data.task) {
      setTasks(prev => [data.task, ...prev])
      setForm({ title: '', description: '', priority: 'medium', due_date: '', assigned_to: '' })
      setShowAdd(false)
    }
  }

  async function updateStatus(taskId: string, status: Status) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, status }),
    })
  }

  async function deleteTask(taskId: string) {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    await fetch('/api/tasks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId }),
    })
  }

  async function saveEdit() {
    if (!editTask) return
    const res = await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: editTask.id,
        title: editTask.title,
        description: editTask.description,
        priority: editTask.priority,
        due_date: editTask.due_date,
        assigned_to: editTask.assigned_to,
        status: editTask.status,
      }),
    })
    const data = await res.json()
    if (data.task) {
      setTasks(prev => prev.map(t => t.id === data.task.id ? data.task : t))
      setEditTask(null)
    }
  }

  function getInitials(name: string | null | undefined) {
    if (!name) return '?'
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  }

  function getAvatarColor(str: string) {
    const colors = ['#5865f2','#ed4245','#e8912d','#2eb67d','#4a90d9','#7b2d8b']
    let h = 0; for (const c of str) h = h * 31 + c.charCodeAt(0)
    return colors[Math.abs(h) % colors.length]
  }

  function formatDate(d: string) {
    const date = new Date(d)
    const today = new Date()
    const diff = Math.ceil((date.getTime() - today.setHours(0,0,0,0)) / 86400000)
    if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, color: '#ed4245' }
    if (diff === 0) return { label: 'Due today', color: '#faa61a' }
    if (diff === 1) return { label: 'Due tomorrow', color: '#faa61a' }
    return { label: `Due ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, color: '#72767d' }
  }

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)
  const counts = { not_started: tasks.filter(t => t.status === 'not_started').length, in_progress: tasks.filter(t => t.status === 'in_progress').length, completed: tasks.filter(t => t.status === 'completed').length }
  const memberList = members.map(m => (m as Record<string,unknown>).profiles as Record<string,unknown>).filter(Boolean)

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#72767d' }}>
      Loading tasks…
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#222529' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #2a2d31', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f2f3f5' }}>Task Board</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#72767d' }}>{tasks.length} total tasks</p>
        </div>
        {/* Filter */}
        <div style={{ display: 'flex', gap: 6 }}>
          {([['all','All', '#b9bbbe'], ...COLUMNS.map(c => [c.key, c.label, c.color])] as [string,string,string][]).map(([key, label, color]) => (
            <button key={key} onClick={() => setFilter(key as typeof filter)}
              style={{ background: filter === key ? 'rgba(74,144,217,.15)' : 'transparent', border: `1px solid ${filter === key ? '#4a90d9' : '#3f4348'}`, borderRadius: 20, padding: '4px 12px', color: filter === key ? '#4a90d9' : color, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              {label} {key !== 'all' && <span style={{ opacity: .7 }}>({counts[key as Status] ?? tasks.length})</span>}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAdd(true)}
          style={{ background: '#4a90d9', border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600 }}>
          <Plus size={16} /> Add Task
        </button>
      </div>

      {/* Columns */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, padding: 20, alignContent: 'start' }}>
        {COLUMNS.map(col => {
          const colTasks = filtered.filter(t => t.status === col.key)
          return (
            <div key={col.key}>
              {/* Column header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 12px', background: col.bg, borderRadius: 8, border: `1px solid ${col.color}30` }}>
                <span style={{ color: col.color }}>{col.icon}</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: col.color }}>{col.label}</span>
                <span style={{ marginLeft: 'auto', background: col.color, color: '#fff', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{colTasks.length}</span>
              </div>

              {/* Tasks */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {colTasks.length === 0 && (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#72767d', fontSize: 13, border: '1px dashed #3f4348', borderRadius: 8 }}>No tasks</div>
                )}
                {colTasks.map(task => (
                  <div key={task.id}
                    style={{ background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 8, padding: '12px 14px', cursor: 'pointer', transition: 'border-color .15s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#4a90d9')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#3f4348')}
                    onClick={() => setEditTask(task)}>

                    {/* Priority + delete */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: PRIORITY_CONFIG[task.priority].color, background: `${PRIORITY_CONFIG[task.priority].color}18`, border: `1px solid ${PRIORITY_CONFIG[task.priority].color}30`, borderRadius: 4, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Flag size={10} /> {PRIORITY_CONFIG[task.priority].label}
                      </span>
                      {(task.created_by === currentUserId) && (
                        <button onClick={e => { e.stopPropagation(); deleteTask(task.id) }}
                          style={{ background: 'none', border: 'none', color: '#72767d', cursor: 'pointer', padding: 2, borderRadius: 4, display: 'flex', alignItems: 'center' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#ed4245')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#72767d')}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    <div style={{ fontSize: 14, fontWeight: 600, color: '#f2f3f5', marginBottom: task.description ? 6 : 10, lineHeight: 1.4 }}>{task.title}</div>
                    {task.description && (
                      <div style={{ fontSize: 12, color: '#72767d', marginBottom: 10, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{task.description}</div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                      {/* Due date */}
                      {task.due_date && (() => { const d = formatDate(task.due_date); return (
                        <span style={{ fontSize: 11, color: d.color, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Calendar size={11} /> {d.label}
                        </span>
                      )})()}

                      {/* Assigned */}
                      {task.assigned_to_profile && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 20, height: 20, borderRadius: '50%', background: getAvatarColor(task.assigned_to || ''), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700 }}>
                            {getInitials(task.assigned_to_profile.full_name)}
                          </div>
                          <span style={{ fontSize: 11, color: '#72767d' }}>{task.assigned_to_profile.full_name?.split(' ')[0]}</span>
                        </div>
                      )}
                    </div>

                    {/* Status change buttons */}
                    <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
                      {COLUMNS.filter(c => c.key !== task.status).map(c => (
                        <button key={c.key} onClick={e => { e.stopPropagation(); updateStatus(task.id, c.key) }}
                          style={{ flex: 1, background: c.bg, border: `1px solid ${c.color}40`, borderRadius: 4, padding: '4px 0', color: c.color, cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>
                          → {c.label.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Task Modal */}
      {showAdd && (
        <div style={overlayStyle} onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div style={modalStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>New Task</h3>
              <button onClick={() => setShowAdd(false)} style={closeBtnStyle}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lblStyle}>Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="What needs to be done?" autoFocus style={inpStyle}
                  onKeyDown={e => e.key === 'Enter' && createTask()} />
              </div>
              <div>
                <label style={lblStyle}>Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Add more details…" rows={3}
                  style={{ ...inpStyle, resize: 'none', lineHeight: 1.5 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lblStyle}>Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}
                    style={{ ...inpStyle, cursor: 'pointer' }}>
                    <option value="low">🔵 Low</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="high">🔴 High</option>
                  </select>
                </div>
                <div>
                  <label style={lblStyle}>Due date</label>
                  <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    style={inpStyle} />
                </div>
              </div>
              <div>
                <label style={lblStyle}>Assign to</label>
                <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                  style={{ ...inpStyle, cursor: 'pointer' }}>
                  <option value="">Unassigned</option>
                  {memberList.map(p => (
                    <option key={String(p.id)} value={String(p.id)}>{String(p.full_name || p.username || p.email)}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setShowAdd(false)} style={{ flex: 1, ...cancelBtnStyle }}>Cancel</button>
                <button onClick={createTask} disabled={!form.title.trim()}
                  style={{ flex: 1, ...primaryBtnStyle, opacity: !form.title.trim() ? .6 : 1 }}>Create Task</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editTask && (
        <div style={overlayStyle} onClick={e => e.target === e.currentTarget && setEditTask(null)}>
          <div style={modalStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Edit Task</h3>
              <button onClick={() => setEditTask(null)} style={closeBtnStyle}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lblStyle}>Title *</label>
                <input value={editTask.title} onChange={e => setEditTask(t => t ? { ...t, title: e.target.value } : t)}
                  autoFocus style={inpStyle} />
              </div>
              <div>
                <label style={lblStyle}>Description</label>
                <textarea value={editTask.description || ''} onChange={e => setEditTask(t => t ? { ...t, description: e.target.value } : t)}
                  rows={3} style={{ ...inpStyle, resize: 'none', lineHeight: 1.5 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lblStyle}>Status</label>
                  <select value={editTask.status} onChange={e => setEditTask(t => t ? { ...t, status: e.target.value as Status } : t)}
                    style={{ ...inpStyle, cursor: 'pointer' }}>
                    <option value="not_started">⚪ Not Started</option>
                    <option value="in_progress">🟡 In Progress</option>
                    <option value="completed">🟢 Completed</option>
                  </select>
                </div>
                <div>
                  <label style={lblStyle}>Priority</label>
                  <select value={editTask.priority} onChange={e => setEditTask(t => t ? { ...t, priority: e.target.value as Priority } : t)}
                    style={{ ...inpStyle, cursor: 'pointer' }}>
                    <option value="low">🔵 Low</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="high">🔴 High</option>
                  </select>
                </div>
                <div>
                  <label style={lblStyle}>Due date</label>
                  <input type="date" value={editTask.due_date || ''} onChange={e => setEditTask(t => t ? { ...t, due_date: e.target.value } : t)}
                    style={inpStyle} />
                </div>
              </div>
              <div>
                <label style={lblStyle}>Assign to</label>
                <select value={editTask.assigned_to || ''} onChange={e => setEditTask(t => t ? { ...t, assigned_to: e.target.value || null } : t)}
                  style={{ ...inpStyle, cursor: 'pointer' }}>
                  <option value="">Unassigned</option>
                  {memberList.map(p => (
                    <option key={String(p.id)} value={String(p.id)}>{String(p.full_name || p.username)}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setEditTask(null)} style={{ flex: 1, ...cancelBtnStyle }}>Cancel</button>
                <button onClick={saveEdit} disabled={!editTask.title.trim()}
                  style={{ flex: 1, ...primaryBtnStyle }}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }
const modalStyle: React.CSSProperties = { background: '#222529', border: '1px solid #3f4348', borderRadius: 12, padding: 28, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }
const closeBtnStyle: React.CSSProperties = { background: 'none', border: 'none', color: '#72767d', cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: 6, padding: 4 }
const lblStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#b9bbbe', marginBottom: 6 }
const inpStyle: React.CSSProperties = { width: '100%', background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 6, padding: '9px 12px', color: '#f2f3f5', fontSize: 14, outline: 'none', fontFamily: 'inherit' }
const cancelBtnStyle: React.CSSProperties = { padding: '10px', borderRadius: 8, border: '1px solid #3f4348', background: '#2c2f33', color: '#b9bbbe', cursor: 'pointer', fontSize: 14, fontWeight: 600 }
const primaryBtnStyle: React.CSSProperties = { padding: '10px', borderRadius: 8, border: 'none', background: '#4a90d9', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }
