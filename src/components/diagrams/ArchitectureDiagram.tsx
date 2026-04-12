'use client'

import { useState, useRef, useEffect } from 'react'
import { Download, Trash2, Plus, ZoomIn, ZoomOut, RotateCcw, Save, Upload, FolderOpen } from 'lucide-react'

type NodeType = 'server' | 'database' | 'client' | 'cloud' | 'api' | 'queue' | 'cache' | 'cdn' | 'loadbalancer' | 'microservice' | 'storage' | 'user'
type ConnectorStyle = 'solid' | 'dashed' | 'dotted'

interface DiagramNode { id: string; type: NodeType; label: string; x: number; y: number; color: string; description?: string }
interface Connection { id: string; from: string; to: string; label?: string; style: ConnectorStyle; color: string }

const NODE_TYPES: { type: NodeType; icon: string; label: string; color: string }[] = [
  { type: 'user',         icon: '👤', label: 'User',         color: '#5865f2' },
  { type: 'client',       icon: '🖥',  label: 'Frontend',    color: '#4a90d9' },
  { type: 'api',          icon: '🔌', label: 'API Gateway',  color: '#e8912d' },
  { type: 'server',       icon: '⚙️', label: 'Server',      color: '#2eb67d' },
  { type: 'microservice', icon: '🧩', label: 'Service',      color: '#7b2d8b' },
  { type: 'database',     icon: '🗄', label: 'Database',     color: '#ed4245' },
  { type: 'cache',        icon: '⚡', label: 'Cache',        color: '#faa61a' },
  { type: 'queue',        icon: '📬', label: 'Queue',        color: '#e91e8c' },
  { type: 'cloud',        icon: '☁️', label: 'Cloud',        color: '#4a90d9' },
  { type: 'cdn',          icon: '🌐', label: 'CDN',          color: '#2eb67d' },
  { type: 'loadbalancer', icon: '⚖️', label: 'Load Bal.',   color: '#faa61a' },
  { type: 'storage',      icon: '💾', label: 'Storage',      color: '#72767d' },
]

const TEMPLATES = {
  blank: { nodes: [], connections: [] },
  'three-tier': {
    nodes: [
      { id:'1', type:'user'         as NodeType, label:'Users',          x:300, y:40,  color:'#5865f2' },
      { id:'2', type:'cdn'          as NodeType, label:'CDN',            x:300, y:150, color:'#2eb67d' },
      { id:'3', type:'client'       as NodeType, label:'React Frontend', x:300, y:260, color:'#4a90d9' },
      { id:'4', type:'loadbalancer' as NodeType, label:'Load Balancer',  x:300, y:380, color:'#faa61a' },
      { id:'5', type:'server'       as NodeType, label:'API Server 1',   x:150, y:500, color:'#2eb67d' },
      { id:'6', type:'server'       as NodeType, label:'API Server 2',   x:460, y:500, color:'#2eb67d' },
      { id:'7', type:'database'     as NodeType, label:'PostgreSQL',     x:200, y:640, color:'#ed4245' },
      { id:'8', type:'cache'        as NodeType, label:'Redis Cache',    x:420, y:640, color:'#faa61a' },
    ],
    connections: [
      { id:'c1', from:'1', to:'2', style:'solid' as ConnectorStyle, color:'#72767d' },
      { id:'c2', from:'2', to:'3', style:'solid' as ConnectorStyle, color:'#72767d' },
      { id:'c3', from:'3', to:'4', label:'HTTPS', style:'solid' as ConnectorStyle, color:'#4a90d9' },
      { id:'c4', from:'4', to:'5', style:'solid' as ConnectorStyle, color:'#72767d' },
      { id:'c5', from:'4', to:'6', style:'solid' as ConnectorStyle, color:'#72767d' },
      { id:'c6', from:'5', to:'7', label:'SQL', style:'solid' as ConnectorStyle, color:'#ed4245' },
      { id:'c7', from:'6', to:'7', label:'SQL', style:'solid' as ConnectorStyle, color:'#ed4245' },
      { id:'c8', from:'5', to:'8', label:'Cache', style:'dashed' as ConnectorStyle, color:'#faa61a' },
      { id:'c9', from:'6', to:'8', label:'Cache', style:'dashed' as ConnectorStyle, color:'#faa61a' },
    ],
  },
  microservices: {
    nodes: [
      { id:'1',  type:'user'         as NodeType, label:'Client',          x:300, y:30,  color:'#5865f2' },
      { id:'2',  type:'api'          as NodeType, label:'API Gateway',     x:300, y:140, color:'#e8912d' },
      { id:'3',  type:'microservice' as NodeType, label:'Auth Service',    x:80,  y:260, color:'#7b2d8b' },
      { id:'4',  type:'microservice' as NodeType, label:'User Service',    x:240, y:260, color:'#7b2d8b' },
      { id:'5',  type:'microservice' as NodeType, label:'Order Service',   x:400, y:260, color:'#7b2d8b' },
      { id:'6',  type:'microservice' as NodeType, label:'Payment Service', x:560, y:260, color:'#7b2d8b' },
      { id:'7',  type:'queue'        as NodeType, label:'Message Bus',     x:300, y:400, color:'#e91e8c' },
      { id:'8',  type:'database'     as NodeType, label:'User DB',         x:120, y:530, color:'#ed4245' },
      { id:'9',  type:'database'     as NodeType, label:'Order DB',        x:360, y:530, color:'#ed4245' },
      { id:'10', type:'cache'        as NodeType, label:'Redis',           x:560, y:530, color:'#faa61a' },
    ],
    connections: [
      { id:'c1',  from:'1',  to:'2',  label:'HTTPS', style:'solid' as ConnectorStyle, color:'#4a90d9' },
      { id:'c2',  from:'2',  to:'3',  style:'solid' as ConnectorStyle, color:'#72767d' },
      { id:'c3',  from:'2',  to:'4',  style:'solid' as ConnectorStyle, color:'#72767d' },
      { id:'c4',  from:'2',  to:'5',  style:'solid' as ConnectorStyle, color:'#72767d' },
      { id:'c5',  from:'2',  to:'6',  style:'solid' as ConnectorStyle, color:'#72767d' },
      { id:'c6',  from:'4',  to:'7',  style:'dashed' as ConnectorStyle, color:'#e91e8c' },
      { id:'c7',  from:'5',  to:'7',  style:'dashed' as ConnectorStyle, color:'#e91e8c' },
      { id:'c8',  from:'6',  to:'7',  style:'dashed' as ConnectorStyle, color:'#e91e8c' },
      { id:'c9',  from:'4',  to:'8',  label:'SQL', style:'solid' as ConnectorStyle, color:'#ed4245' },
      { id:'c10', from:'5',  to:'9',  label:'SQL', style:'solid' as ConnectorStyle, color:'#ed4245' },
      { id:'c11', from:'3',  to:'10', label:'Cache', style:'dashed' as ConnectorStyle, color:'#faa61a' },
    ],
  },
}

// Canvas dimensions — large fixed size so all nodes are always reachable via scroll
const CANVAS_W = 3000
const CANVAS_H = 3000

export default function ArchitectureDiagram() {
  const [nodes, setNodes] = useState<DiagramNode[]>(TEMPLATES['three-tier'].nodes)
  const [connections, setConnections] = useState<Connection[]>(TEMPLATES['three-tier'].connections)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [selectedConn, setSelectedConn] = useState<string | null>(null)
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [editingNode, setEditingNode] = useState<DiagramNode | null>(null)
  const [editingConn, setEditingConn] = useState<Connection | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [saved, setSaved] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Convert screen coords → SVG canvas coords (accounts for scroll + zoom)
  function screenToCanvas(clientX: number, clientY: number) {
    const container = scrollContainerRef.current
    const svg = svgRef.current
    if (!container || !svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return {
      x: (clientX - rect.left) / zoom,
      y: (clientY - rect.top) / zoom,
    }
  }

  function addNode(type: NodeType) {
    const conf = NODE_TYPES.find(n => n.type === type)!
    // Place near center of current scroll view
    const container = scrollContainerRef.current
    const cx = container ? (container.scrollLeft + container.clientWidth / 2) / zoom : 400
    const cy = container ? (container.scrollTop + container.clientHeight / 2) / zoom : 300
    const newNode: DiagramNode = {
      id: Date.now().toString(), type,
      label: conf.label,
      x: cx - 60 + (Math.random() - 0.5) * 80,
      y: cy - 30 + (Math.random() - 0.5) * 80,
      color: conf.color,
    }
    setNodes(prev => [...prev, newNode])
    setSelectedNode(newNode.id)
  }

  function deleteSelected() {
    if (selectedNode) {
      setNodes(prev => prev.filter(n => n.id !== selectedNode))
      setConnections(prev => prev.filter(c => c.from !== selectedNode && c.to !== selectedNode))
      setSelectedNode(null)
    }
    if (selectedConn) {
      setConnections(prev => prev.filter(c => c.id !== selectedConn))
      setSelectedConn(null)
    }
  }

  function handleNodeMouseDown(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (connecting) {
      if (connecting !== id) {
        setConnections(prev => [...prev, {
          id: Date.now().toString(), from: connecting, to: id,
          style: 'solid', color: '#72767d',
        }])
      }
      setConnecting(null)
      return
    }
    const pt = screenToCanvas(e.clientX, e.clientY)
    const node = nodes.find(n => n.id === id)!
    setDragging({ id, offsetX: pt.x - node.x, offsetY: pt.y - node.y })
    setSelectedNode(id)
    setSelectedConn(null)
  }

  function handleSvgMouseDown(e: React.MouseEvent) {
    if (e.target === svgRef.current || (e.target as SVGElement).tagName === 'rect') {
      // Only deselect if clicking on background rect
      const target = e.target as SVGElement
      if (target === svgRef.current || target.getAttribute('fill') === 'url(#grid)') {
        setSelectedNode(null)
        setSelectedConn(null)
      }
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    const pt = screenToCanvas(e.clientX, e.clientY)
    setMousePos(pt)
    if (dragging) {
      setNodes(prev => prev.map(n =>
        n.id === dragging.id
          ? { ...n,
              x: Math.max(0, Math.min(CANVAS_W - 130, pt.x - dragging.offsetX)),
              y: Math.max(0, Math.min(CANVAS_H - 70,  pt.y - dragging.offsetY)),
            }
          : n
      ))
    }
  }

  function handleMouseUp() { setDragging(null) }

  function getNodeCenter(id: string) {
    const node = nodes.find(n => n.id === id)
    if (!node) return { x: 0, y: 0 }
    return { x: node.x + 60, y: node.y + 30 }
  }

  function getConnPath(conn: Connection) {
    const from = getNodeCenter(conn.from)
    const to = getNodeCenter(conn.to)
    const dx = to.x - from.x
    return `M ${from.x} ${from.y} C ${from.x + dx * 0.5} ${from.y}, ${to.x - dx * 0.3} ${to.y}, ${to.x} ${to.y}`
  }

  // Export diagram as JSON file
  function exportJSON() {
    const data = { nodes, connections, version: 1, exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `diagram-${Date.now()}.slackr.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // Import diagram from JSON file
  function importJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (data.nodes && Array.isArray(data.nodes)) {
          setNodes(data.nodes)
          setConnections(data.connections || [])
          setSelectedNode(null)
          setSelectedConn(null)
          // Scroll to content
          setTimeout(() => {
            if (data.nodes.length > 0) {
              const minX = Math.min(...data.nodes.map((n: DiagramNode) => n.x))
              const minY = Math.min(...data.nodes.map((n: DiagramNode) => n.y))
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollLeft = Math.max(0, minX * zoom - 60)
                scrollContainerRef.current.scrollTop  = Math.max(0, minY * zoom - 60)
              }
            }
          }, 100)
        } else {
          alert('Invalid diagram file. Please use a .slackr.json file exported from this tool.')
        }
      } catch {
        alert('Could not read file. Make sure it is a valid .slackr.json diagram file.')
      }
    }
    reader.readAsText(file)
    // Reset so same file can be re-imported
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function exportSVG() {
    const svgEl = svgRef.current
    if (!svgEl) return
    const clone = svgEl.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const blob = new Blob([clone.outerHTML], { type: 'image/svg+xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'architecture-diagram.svg'
    a.click()
  }

  function saveLocally() {
    localStorage.setItem('slackr-diagram', JSON.stringify({ nodes, connections }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function loadTemplate(key: keyof typeof TEMPLATES) {
    setNodes(TEMPLATES[key].nodes)
    setConnections(TEMPLATES[key].connections as Connection[])
    setSelectedNode(null); setSelectedConn(null)
  }

  useEffect(() => {
    const s = localStorage.getItem('slackr-diagram')
    if (s) { try { const { nodes: n, connections: c } = JSON.parse(s); if (n?.length) { setNodes(n); setConnections(c) } } catch {} }
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && !['INPUT','TEXTAREA'].includes((e.target as HTMLElement).tagName)) deleteSelected()
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveLocally() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selectedNode, selectedConn])

  const selNodeData = nodes.find(n => n.id === selectedNode)
  const selConnData = connections.find(c => c.id === selectedConn)

  // Scroll to bring nodes into view on load
  useEffect(() => {
    if (nodes.length === 0) return
    const minX = Math.min(...nodes.map(n => n.x))
    const minY = Math.min(...nodes.map(n => n.y))
    const container = scrollContainerRef.current
    if (container) {
      container.scrollLeft = Math.max(0, minX * zoom - 60)
      container.scrollTop  = Math.max(0, minY * zoom - 60)
    }
  }, []) // only on mount

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1a1d21', color: '#f2f3f5', overflow: 'hidden' }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: '#222529', borderBottom: '1px solid #2a2d31', flexWrap: 'wrap', flexShrink: 0 }}>
        {/* Templates */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#72767d', whiteSpace: 'nowrap' }}>Template:</span>
          {(['blank','three-tier','microservices'] as const).map(t => (
            <button key={t} onClick={() => loadTemplate(t)}
              style={{ background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 5, padding: '3px 9px', color: '#b9bbbe', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>
              {t === 'blank' ? 'Blank' : t === 'three-tier' ? '3-Tier' : 'Microservices'}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 20, background: '#3f4348', flexShrink: 0 }} />

        {/* Node type buttons */}
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {NODE_TYPES.map(nt => (
            <button key={nt.type} onClick={() => addNode(nt.type)} title={nt.label}
              style={{ background: '#2c2f33', border: `1px solid ${nt.color}50`, borderRadius: 5, padding: '3px 7px', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 3, color: nt.color, lineHeight: 1 }}>
              <span>{nt.icon}</span>
              <span style={{ fontSize: 10, color: nt.color, display: 'none' }} className="diagram-label-hide">{nt.label}</span>
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: '#3f4348', flexShrink: 0 }} />

        {/* Connect + Delete */}
        <button onClick={() => setConnecting(connecting ? null : selectedNode)}
          disabled={!selectedNode && !connecting}
          style={{ background: connecting ? 'rgba(74,144,217,.2)' : '#2c2f33', border: `1px solid ${connecting ? '#4a90d9' : '#3f4348'}`, borderRadius: 5, padding: '3px 10px', color: connecting ? '#4a90d9' : '#b9bbbe', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {connecting ? '🔗 click target' : '🔗 Connect'}
        </button>

        {(selectedNode || selectedConn) && (
          <button onClick={deleteSelected}
            style={{ background: 'rgba(237,66,69,.12)', border: '1px solid rgba(237,66,69,.3)', borderRadius: 5, padding: '3px 10px', color: '#ed4245', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Trash2 size={12} /> Delete
          </button>
        )}

        {/* Zoom + actions */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, alignItems: 'center' }}>
          <button onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(1)))} style={tb}><ZoomIn size={14} /></button>
          <span style={{ fontSize: 11, color: '#72767d', minWidth: 32, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.max(0.25, +(z - 0.1).toFixed(1)))} style={tb}><ZoomOut size={14} /></button>
          <button onClick={() => setZoom(1)} style={tb} title="Reset zoom"><RotateCcw size={14} /></button>
          <button onClick={saveLocally} style={{ ...tb, color: saved ? '#2eb67d' : '#b9bbbe' }} title="Save to browser (Ctrl+S)"><Save size={14} /></button>
          <button onClick={exportJSON} style={{ ...tb, background: '#2eb67d', color: '#fff', border: 'none' }} title="Export diagram as .json file (can reimport later)">
            <Download size={14} />
            <span style={{ fontSize: 10, marginLeft: 3 }}>Export</span>
          </button>
          <button onClick={() => fileInputRef.current?.click()} style={{ ...tb, background: '#e8912d', color: '#fff', border: 'none' }} title="Import diagram from .json file">
            <Upload size={14} />
            <span style={{ fontSize: 10, marginLeft: 3 }}>Import</span>
          </button>
          <button onClick={exportSVG} style={{ ...tb, background: '#4a90d9', color: '#fff', border: 'none' }} title="Export as SVG image"><Download size={14} /></button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* ── Canvas: scrollable container with fixed large SVG inside ── */}
        <div
          ref={scrollContainerRef}
          style={{
            flex: 1,
            overflow: 'auto',          // always scrollable
            cursor: connecting ? 'crosshair' : dragging ? 'grabbing' : 'default',
            background: '#1a1d21',
            WebkitOverflowScrolling: 'touch',
          } as React.CSSProperties}
        >
          <svg
            ref={svgRef}
            width={CANVAS_W * zoom}
            height={CANVAS_H * zoom}
            style={{ display: 'block', background: '#1a1d21', userSelect: 'none' }}
            onMouseMove={handleMouseMove}
            onMouseDown={handleSvgMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <defs>
              <pattern id="grid" width={40} height={40} patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#252830" strokeWidth="0.8" />
              </pattern>
              {connections.map(c => (
                <marker key={`m-${c.id}`} id={`arrow-${c.id}`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill={c.color} />
                </marker>
              ))}
            </defs>

            {/* Grid background */}
            <g transform={`scale(${zoom})`}>
              <rect width={CANVAS_W} height={CANVAS_H} fill="url(#grid)" />
            </g>

            {/* All diagram elements inside a single zoom group */}
            <g transform={`scale(${zoom})`}>

              {/* Connections */}
              {connections.map(conn => {
                const path = getConnPath(conn)
                const from = getNodeCenter(conn.from)
                const to = getNodeCenter(conn.to)
                const mx = (from.x + to.x) / 2
                const my = (from.y + to.y) / 2
                const isSel = selectedConn === conn.id
                return (
                  <g key={conn.id} onClick={() => { setSelectedConn(conn.id); setSelectedNode(null) }} style={{ cursor: 'pointer' }}>
                    <path d={path} fill="none" stroke="transparent" strokeWidth={14} />
                    <path d={path} fill="none"
                      stroke={isSel ? '#4a90d9' : conn.color}
                      strokeWidth={isSel ? 2.5 : 1.5}
                      strokeDasharray={conn.style === 'dashed' ? '8 4' : conn.style === 'dotted' ? '2 4' : undefined}
                      markerEnd={`url(#arrow-${conn.id})`}
                      opacity={0.85}
                    />
                    {conn.label && (
                      <>
                        <rect x={mx - 22} y={my - 9} width={44} height={18} rx={4} fill="#1a1d21" stroke={conn.color} strokeWidth="0.8" />
                        <text x={mx} y={my + 3.5} textAnchor="middle" fill={conn.color} fontSize={10} fontFamily="system-ui">{conn.label}</text>
                      </>
                    )}
                  </g>
                )
              })}

              {/* Live wire while connecting */}
              {connecting && (
                <line
                  x1={getNodeCenter(connecting).x} y1={getNodeCenter(connecting).y}
                  x2={mousePos.x} y2={mousePos.y}
                  stroke="#4a90d9" strokeWidth={1.5} strokeDasharray="6 3" opacity={0.7}
                />
              )}

              {/* Nodes */}
              {nodes.map(node => {
                const conf = NODE_TYPES.find(n => n.type === node.type)!
                const isSel = selectedNode === node.id
                return (
                  <g key={node.id}
                    transform={`translate(${node.x},${node.y})`}
                    onMouseDown={e => handleNodeMouseDown(e, node.id)}
                    onDoubleClick={() => setEditingNode({ ...node })}
                    style={{ cursor: dragging?.id === node.id ? 'grabbing' : 'grab' }}>
                    {/* Shadow */}
                    <rect x={3} y={5} width={120} height={56} rx={10} fill="rgba(0,0,0,.35)" />
                    {/* Body */}
                    <rect x={0} y={0} width={120} height={56} rx={10}
                      fill={`${node.color}18`}
                      stroke={isSel ? '#4a90d9' : node.color}
                      strokeWidth={isSel ? 2.5 : 1.5} />
                    {/* Icon bg */}
                    <rect x={7} y={8} width={34} height={34} rx={7} fill={`${node.color}25`} />
                    {/* Icon */}
                    <text x={24} y={30} textAnchor="middle" fontSize={17} fontFamily="system-ui">{conf.icon}</text>
                    {/* Label */}
                    <foreignObject x={46} y={5} width={68} height={46}>
                      <div style={{ display:'flex', alignItems:'center', height:'100%', overflow:'hidden' }}>
                        <span style={{ fontSize:10, fontWeight:600, color:'#f2f3f5', lineHeight:1.35, wordBreak:'break-word', fontFamily:'system-ui' }}>{node.label}</span>
                      </div>
                    </foreignObject>
                    {/* Selection ring */}
                    {isSel && <rect x={-4} y={-4} width={128} height={64} rx={13} fill="none" stroke="#4a90d9" strokeWidth={1} strokeDasharray="4 2" opacity={0.5} />}
                    {/* Connect handle */}
                    {isSel && !connecting && (
                      <circle cx={120} cy={28} r={7} fill="#4a90d9" stroke="#fff" strokeWidth={1.5} style={{ cursor:'pointer' }}
                        onMouseDown={e => { e.stopPropagation(); setConnecting(node.id) }} />
                    )}
                  </g>
                )
              })}
            </g>

            {nodes.length === 0 && (
              <text x={CANVAS_W * zoom / 2} y={300 * zoom} textAnchor="middle" fill="#3f4348" fontSize={14} fontFamily="system-ui">
                Click a component icon above to add it to the canvas
              </text>
            )}
          </svg>
        </div>

        {/* ── Properties panel ── */}
        {selNodeData && (
          <div style={{ width: 200, background: '#222529', borderLeft: '1px solid #2a2d31', padding: 14, display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0, overflowY: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#b9bbbe', textTransform: 'uppercase', letterSpacing: '.05em' }}>Node</div>
            <div>
              <label style={pLbl}>Label</label>
              <input value={selNodeData.label}
                onChange={e => setNodes(prev => prev.map(n => n.id === selectedNode ? { ...n, label: e.target.value } : n))}
                style={pInp} />
            </div>
            <div>
              <label style={pLbl}>Color</label>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {['#5865f2','#4a90d9','#2eb67d','#ed4245','#faa61a','#e8912d','#7b2d8b','#e91e8c','#72767d'].map(c => (
                  <div key={c} onClick={() => setNodes(prev => prev.map(n => n.id === selectedNode ? { ...n, color: c } : n))}
                    style={{ width: 20, height: 20, borderRadius: 4, background: c, cursor: 'pointer', border: selNodeData.color === c ? '2px solid #fff' : '2px solid transparent' }} />
                ))}
              </div>
            </div>
            <div>
              <label style={pLbl}>Description</label>
              <textarea value={selNodeData.description || ''}
                onChange={e => setNodes(prev => prev.map(n => n.id === selectedNode ? { ...n, description: e.target.value } : n))}
                rows={3} placeholder="Notes…" style={{ ...pInp, resize: 'none', lineHeight: 1.4 }} />
            </div>
            <button onClick={deleteSelected}
              style={{ background: 'rgba(237,66,69,.1)', border: '1px solid rgba(237,66,69,.3)', borderRadius: 5, padding: '6px', color: '#ed4245', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}

        {selConnData && (
          <div style={{ width: 200, background: '#222529', borderLeft: '1px solid #2a2d31', padding: 14, display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0, overflowY: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#b9bbbe', textTransform: 'uppercase', letterSpacing: '.05em' }}>Connection</div>
            <div>
              <label style={pLbl}>Label</label>
              <input value={selConnData.label || ''}
                onChange={e => setConnections(prev => prev.map(c => c.id === selectedConn ? { ...c, label: e.target.value } : c))}
                placeholder="e.g. HTTPS, SQL" style={pInp} />
            </div>
            <div>
              <label style={pLbl}>Style</label>
              <select value={selConnData.style}
                onChange={e => setConnections(prev => prev.map(c => c.id === selectedConn ? { ...c, style: e.target.value as ConnectorStyle } : c))}
                style={{ ...pInp, cursor: 'pointer' }}>
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
              </select>
            </div>
            <div>
              <label style={pLbl}>Color</label>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {['#72767d','#4a90d9','#2eb67d','#ed4245','#faa61a','#e91e8c','#f2f3f5'].map(c => (
                  <div key={c} onClick={() => setConnections(prev => prev.map(cn => cn.id === selectedConn ? { ...cn, color: c } : cn))}
                    style={{ width: 20, height: 20, borderRadius: 4, background: c, cursor: 'pointer', border: selConnData.color === c ? '2px solid #fff' : '2px solid transparent' }} />
                ))}
              </div>
            </div>
            <button onClick={deleteSelected}
              style={{ background: 'rgba(237,66,69,.1)', border: '1px solid rgba(237,66,69,.3)', borderRadius: 5, padding: '6px', color: '#ed4245', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>

      {/* Edit node modal */}
      {editingNode && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
          onClick={e => e.target === e.currentTarget && setEditingNode(null)}>
          <div style={{ background: '#222529', border: '1px solid #3f4348', borderRadius: 10, padding: 24, width: 320 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Edit Node</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={pLbl}>Label</label>
                <input value={editingNode.label} onChange={e => setEditingNode(n => n ? { ...n, label: e.target.value } : n)} autoFocus style={pInp} />
              </div>
              <div><label style={pLbl}>Description</label>
                <textarea value={editingNode.description || ''} onChange={e => setEditingNode(n => n ? { ...n, description: e.target.value } : n)}
                  rows={3} style={{ ...pInp, resize: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => setEditingNode(null)} style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid #3f4348', background: '#2c2f33', color: '#b9bbbe', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => { setNodes(prev => prev.map(n => n.id === editingNode.id ? editingNode : n)); setEditingNode(null) }}
                  style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#4a90d9', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for import */}
      <input ref={fileInputRef} type="file" accept=".json,.slackr.json" style={{ display: 'none' }} onChange={importJSON} />

      {/* Help bar */}
      <div style={{ padding: '4px 12px', background: '#0f1113', borderTop: '1px solid #2a2d31', display: 'flex', gap: 16, flexShrink: 0, overflowX: 'auto' }}>
        {['Click icon → add','Drag → move','Double-click → edit','Select + 🔗 → connect','Click arrow → edit','Del → delete','Ctrl+S → save'].map((h, i) => (
          <span key={i} style={{ fontSize: 10, color: '#3f4348', whiteSpace: 'nowrap' }}>{h}</span>
        ))}
      </div>
    </div>
  )
}

const tb: React.CSSProperties = { width: 28, height: 28, borderRadius: 5, border: '1px solid #3f4348', background: '#2c2f33', color: '#b9bbbe', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const pLbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#72767d', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }
const pInp: React.CSSProperties = { width: '100%', background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 5, padding: '6px 8px', color: '#f2f3f5', fontSize: 13, outline: 'none', fontFamily: 'inherit' }
