'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Download, Trash2, Plus, ZoomIn, ZoomOut, RotateCcw, Save, Share2 } from 'lucide-react'

type NodeType = 'server' | 'database' | 'client' | 'cloud' | 'api' | 'queue' | 'cache' | 'cdn' | 'loadbalancer' | 'microservice' | 'storage' | 'user'
type ConnectorStyle = 'solid' | 'dashed' | 'dotted'

interface DiagramNode {
  id: string
  type: NodeType
  label: string
  x: number
  y: number
  color: string
  description?: string
}

interface Connection {
  id: string
  from: string
  to: string
  label?: string
  style: ConnectorStyle
  color: string
}

const NODE_TYPES: { type: NodeType; icon: string; label: string; color: string }[] = [
  { type: 'user',         icon: '👤', label: 'User/Client',    color: '#5865f2' },
  { type: 'client',       icon: '🖥',  label: 'Frontend',      color: '#4a90d9' },
  { type: 'api',          icon: '🔌', label: 'API Gateway',    color: '#e8912d' },
  { type: 'server',       icon: '⚙️', label: 'Server',        color: '#2eb67d' },
  { type: 'microservice', icon: '🧩', label: 'Microservice',   color: '#7b2d8b' },
  { type: 'database',     icon: '🗄', label: 'Database',       color: '#ed4245' },
  { type: 'cache',        icon: '⚡', label: 'Cache/Redis',    color: '#faa61a' },
  { type: 'queue',        icon: '📬', label: 'Message Queue',  color: '#e91e8c' },
  { type: 'cloud',        icon: '☁️', label: 'Cloud Service',  color: '#4a90d9' },
  { type: 'cdn',          icon: '🌐', label: 'CDN',            color: '#2eb67d' },
  { type: 'loadbalancer', icon: '⚖️', label: 'Load Balancer', color: '#faa61a' },
  { type: 'storage',      icon: '💾', label: 'Storage',        color: '#72767d' },
]

const TEMPLATES = {
  blank: { nodes: [], connections: [] },
  'three-tier': {
    nodes: [
      { id: '1', type: 'user' as NodeType,         label: 'Users',          x: 350, y: 50,  color: '#5865f2' },
      { id: '2', type: 'cdn' as NodeType,           label: 'CDN',            x: 350, y: 160, color: '#2eb67d' },
      { id: '3', type: 'client' as NodeType,        label: 'React Frontend', x: 350, y: 270, color: '#4a90d9' },
      { id: '4', type: 'loadbalancer' as NodeType,  label: 'Load Balancer',  x: 350, y: 380, color: '#faa61a' },
      { id: '5', type: 'server' as NodeType,        label: 'API Server 1',   x: 200, y: 490, color: '#2eb67d' },
      { id: '6', type: 'server' as NodeType,        label: 'API Server 2',   x: 500, y: 490, color: '#2eb67d' },
      { id: '7', type: 'database' as NodeType,      label: 'PostgreSQL',     x: 250, y: 600, color: '#ed4245' },
      { id: '8', type: 'cache' as NodeType,         label: 'Redis Cache',    x: 450, y: 600, color: '#faa61a' },
    ],
    connections: [
      { id: 'c1', from: '1', to: '2', style: 'solid' as ConnectorStyle, color: '#72767d' },
      { id: 'c2', from: '2', to: '3', style: 'solid' as ConnectorStyle, color: '#72767d' },
      { id: 'c3', from: '3', to: '4', label: 'HTTPS', style: 'solid' as ConnectorStyle, color: '#4a90d9' },
      { id: 'c4', from: '4', to: '5', style: 'solid' as ConnectorStyle, color: '#72767d' },
      { id: 'c5', from: '4', to: '6', style: 'solid' as ConnectorStyle, color: '#72767d' },
      { id: 'c6', from: '5', to: '7', label: 'SQL', style: 'solid' as ConnectorStyle, color: '#ed4245' },
      { id: 'c7', from: '6', to: '7', label: 'SQL', style: 'solid' as ConnectorStyle, color: '#ed4245' },
      { id: 'c8', from: '5', to: '8', label: 'Cache', style: 'dashed' as ConnectorStyle, color: '#faa61a' },
      { id: 'c9', from: '6', to: '8', label: 'Cache', style: 'dashed' as ConnectorStyle, color: '#faa61a' },
    ],
  },
  microservices: {
    nodes: [
      { id: '1', type: 'user' as NodeType,         label: 'Client',           x: 350, y: 30,  color: '#5865f2' },
      { id: '2', type: 'api' as NodeType,           label: 'API Gateway',      x: 350, y: 140, color: '#e8912d' },
      { id: '3', type: 'microservice' as NodeType,  label: 'Auth Service',     x: 100, y: 260, color: '#7b2d8b' },
      { id: '4', type: 'microservice' as NodeType,  label: 'User Service',     x: 280, y: 260, color: '#7b2d8b' },
      { id: '5', type: 'microservice' as NodeType,  label: 'Order Service',    x: 460, y: 260, color: '#7b2d8b' },
      { id: '6', type: 'microservice' as NodeType,  label: 'Payment Service',  x: 600, y: 260, color: '#7b2d8b' },
      { id: '7', type: 'queue' as NodeType,         label: 'Message Bus',      x: 350, y: 380, color: '#e91e8c' },
      { id: '8', type: 'database' as NodeType,      label: 'User DB',          x: 150, y: 490, color: '#ed4245' },
      { id: '9', type: 'database' as NodeType,      label: 'Order DB',         x: 380, y: 490, color: '#ed4245' },
      { id: '10',type: 'cache' as NodeType,         label: 'Redis',            x: 580, y: 490, color: '#faa61a' },
    ],
    connections: [
      { id: 'c1', from: '1', to: '2', label: 'HTTPS', style: 'solid' as ConnectorStyle, color: '#4a90d9' },
      { id: 'c2', from: '2', to: '3', style: 'solid' as ConnectorStyle, color: '#72767d' },
      { id: 'c3', from: '2', to: '4', style: 'solid' as ConnectorStyle, color: '#72767d' },
      { id: 'c4', from: '2', to: '5', style: 'solid' as ConnectorStyle, color: '#72767d' },
      { id: 'c5', from: '2', to: '6', style: 'solid' as ConnectorStyle, color: '#72767d' },
      { id: 'c6', from: '4', to: '7', style: 'dashed' as ConnectorStyle, color: '#e91e8c' },
      { id: 'c7', from: '5', to: '7', style: 'dashed' as ConnectorStyle, color: '#e91e8c' },
      { id: 'c8', from: '6', to: '7', style: 'dashed' as ConnectorStyle, color: '#e91e8c' },
      { id: 'c9', from: '4', to: '8', label: 'SQL', style: 'solid' as ConnectorStyle, color: '#ed4245' },
      { id: 'c10',from: '5', to: '9', label: 'SQL', style: 'solid' as ConnectorStyle, color: '#ed4245' },
      { id: 'c11',from: '3', to: '10',label: 'Cache', style: 'dashed' as ConnectorStyle, color: '#faa61a' },
    ],
  },
}

export default function ArchitectureDiagram() {
  const [nodes, setNodes] = useState<DiagramNode[]>(TEMPLATES['three-tier'].nodes)
  const [connections, setConnections] = useState<Connection[]>(TEMPLATES['three-tier'].connections)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [selectedConn, setSelectedConn] = useState<string | null>(null)
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [panning, setPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [editingNode, setEditingNode] = useState<DiagramNode | null>(null)
  const [editingConn, setEditingConn] = useState<Connection | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [saved, setSaved] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  function getSvgPoint(e: React.MouseEvent) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    }
  }

  function addNode(type: NodeType) {
    const conf = NODE_TYPES.find(n => n.type === type)!
    const newNode: DiagramNode = {
      id: Date.now().toString(),
      type,
      label: conf.label,
      x: 200 + Math.random() * 300,
      y: 200 + Math.random() * 200,
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
        const newConn: Connection = {
          id: Date.now().toString(),
          from: connecting,
          to: id,
          style: 'solid',
          color: '#72767d',
        }
        setConnections(prev => [...prev, newConn])
      }
      setConnecting(null)
      return
    }
    const pt = getSvgPoint(e)
    const node = nodes.find(n => n.id === id)!
    setDragging({ id, offsetX: pt.x - node.x, offsetY: pt.y - node.y })
    setSelectedNode(id)
    setSelectedConn(null)
  }

  function handleMouseMove(e: React.MouseEvent) {
    const pt = getSvgPoint(e)
    setMousePos(pt)
    if (dragging) {
      setNodes(prev => prev.map(n =>
        n.id === dragging.id ? { ...n, x: pt.x - dragging.offsetX, y: pt.y - dragging.offsetY } : n
      ))
    }
    if (panning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
    }
  }

  function handleSvgMouseDown(e: React.MouseEvent) {
    if (e.button === 1 || e.altKey) {
      setPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    } else {
      setSelectedNode(null)
      setSelectedConn(null)
    }
  }

  function handleMouseUp() {
    setDragging(null)
    setPanning(false)
  }

  function getNodeCenter(id: string) {
    const node = nodes.find(n => n.id === id)
    if (!node) return { x: 0, y: 0 }
    return { x: node.x + 60, y: node.y + 40 }
  }

  function getConnPath(conn: Connection) {
    const from = getNodeCenter(conn.from)
    const to = getNodeCenter(conn.to)
    const dx = to.x - from.x, dy = to.y - from.y
    const cx = from.x + dx * 0.5, cy = from.y
    const cx2 = to.x - dx * 0.3, cy2 = to.y
    return `M ${from.x} ${from.y} C ${cx} ${cy}, ${cx2} ${cy2}, ${to.x} ${to.y}`
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
    setSelectedNode(null)
    setSelectedConn(null)
  }

  useEffect(() => {
    const saved = localStorage.getItem('slackr-diagram')
    if (saved) {
      try {
        const { nodes: n, connections: c } = JSON.parse(saved)
        if (n?.length) { setNodes(n); setConnections(c) }
      } catch {}
    }
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && !['INPUT','TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        deleteSelected()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveLocally() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selectedNode, selectedConn])

  const selectedNodeData = nodes.find(n => n.id === selectedNode)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1a1d21', color: '#f2f3f5', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#222529', borderBottom: '1px solid #2a2d31', flexWrap: 'wrap', flexShrink: 0, minHeight: 52 }}>
        {/* Templates */}
        <div style={{ display: 'flex', gap: 6, marginRight: 8 }}>
          <span style={{ fontSize: 12, color: '#72767d', alignSelf: 'center' }}>Template:</span>
          {(['blank','three-tier','microservices'] as const).map(t => (
            <button key={t} onClick={() => loadTemplate(t)}
              style={{ background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 6, padding: '4px 10px', color: '#b9bbbe', cursor: 'pointer', fontSize: 12 }}>
              {t === 'blank' ? 'Blank' : t === 'three-tier' ? '3-Tier' : 'Microservices'}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: '#3f4348' }} />

        {/* Add nodes */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {NODE_TYPES.map(nt => (
            <button key={nt.type} onClick={() => addNode(nt.type)}
              title={`Add ${nt.label}`}
              style={{ background: '#2c2f33', border: `1px solid ${nt.color}40`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, color: nt.color }}>
              <span>{nt.icon}</span>
              <span style={{ fontSize: 11 }} className="diagram-label-hide">{nt.label}</span>
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: '#3f4348' }} />

        {/* Connect mode */}
        <button onClick={() => setConnecting(connecting ? null : selectedNode)}
          disabled={!selectedNode && !connecting}
          title="Connect nodes (select node first, then click Connect, then click target)"
          style={{ background: connecting ? 'rgba(74,144,217,.2)' : '#2c2f33', border: `1px solid ${connecting ? '#4a90d9' : '#3f4348'}`, borderRadius: 6, padding: '5px 12px', color: connecting ? '#4a90d9' : '#b9bbbe', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
          {connecting ? '🔗 Click target' : '🔗 Connect'}
        </button>

        {(selectedNode || selectedConn) && (
          <button onClick={deleteSelected}
            style={{ background: 'rgba(237,66,69,.15)', border: '1px solid rgba(237,66,69,.3)', borderRadius: 6, padding: '5px 12px', color: '#ed4245', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Trash2 size={13} /> Delete
          </button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Zoom */}
          <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} style={toolBtn}><ZoomIn size={15} /></button>
          <span style={{ fontSize: 12, color: '#72767d', minWidth: 36, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} style={toolBtn}><ZoomOut size={15} /></button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} style={toolBtn} title="Reset view"><RotateCcw size={15} /></button>
          <button onClick={saveLocally} style={{ ...toolBtn, color: saved ? '#2eb67d' : '#b9bbbe' }} title="Save (Ctrl+S)"><Save size={15} /></button>
          <button onClick={exportSVG} style={{ ...toolBtn, background: '#4a90d9', color: '#fff' }} title="Export SVG"><Download size={15} /></button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Canvas */}
        <div ref={containerRef} style={{ flex: 1, overflow: 'auto', position: 'relative', cursor: connecting ? 'crosshair' : panning ? 'grabbing' : 'default', WebkitOverflowScrolling: 'touch' as unknown as undefined }}>
          <svg
            ref={svgRef}
            style={{ width: '100%', height: '100%', minWidth: 600, minHeight: 500, background: '#1a1d21' }}
            onMouseMove={handleMouseMove}
            onMouseDown={handleSvgMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <defs>
              <pattern id="grid" width={40 * zoom} height={40 * zoom} patternUnits="userSpaceOnUse" x={pan.x % (40 * zoom)} y={pan.y % (40 * zoom)}>
                <path d={`M ${40 * zoom} 0 L 0 0 0 ${40 * zoom}`} fill="none" stroke="#2a2d31" strokeWidth="0.5" />
              </pattern>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#72767d" />
              </marker>
              {connections.map(c => (
                <marker key={`m-${c.id}`} id={`arrow-${c.id}`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill={c.color} />
                </marker>
              ))}
            </defs>

            {/* Grid */}
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Transform group */}
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {/* Connections */}
              {connections.map(conn => {
                const path = getConnPath(conn)
                const from = getNodeCenter(conn.from)
                const to = getNodeCenter(conn.to)
                const mx = (from.x + to.x) / 2
                const my = (from.y + to.y) / 2
                const isSelected = selectedConn === conn.id
                return (
                  <g key={conn.id} onClick={() => { setSelectedConn(conn.id); setSelectedNode(null) }} style={{ cursor: 'pointer' }}>
                    {/* Click area */}
                    <path d={path} fill="none" stroke="transparent" strokeWidth={12} />
                    <path d={path} fill="none" stroke={isSelected ? '#4a90d9' : conn.color}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      strokeDasharray={conn.style === 'dashed' ? '8 4' : conn.style === 'dotted' ? '2 4' : undefined}
                      markerEnd={`url(#arrow-${conn.id})`}
                      opacity={0.8}
                    />
                    {conn.label && (
                      <g>
                        <rect x={mx - 20} y={my - 10} width={40} height={18} rx={4} fill="#1a1d21" stroke={conn.color} strokeWidth="0.5" />
                        <text x={mx} y={my + 3} textAnchor="middle" fill={conn.color} fontSize={10} fontFamily="system-ui">{conn.label}</text>
                      </g>
                    )}
                  </g>
                )
              })}

              {/* Live connection line while connecting */}
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
                const isSelected = selectedNode === node.id
                return (
                  <g key={node.id}
                    transform={`translate(${node.x},${node.y})`}
                    onMouseDown={e => handleNodeMouseDown(e, node.id)}
                    onDoubleClick={() => setEditingNode({ ...node })}
                    style={{ cursor: dragging?.id === node.id ? 'grabbing' : 'grab' }}>
                    {/* Shadow */}
                    <rect x={2} y={4} width={120} height={60} rx={10} fill="rgba(0,0,0,.3)" />
                    {/* Card */}
                    <rect x={0} y={0} width={120} height={60} rx={10}
                      fill={`${node.color}18`}
                      stroke={isSelected ? '#4a90d9' : node.color}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                    />
                    {/* Icon background */}
                    <rect x={8} y={8} width={36} height={36} rx={8} fill={`${node.color}28`} stroke={`${node.color}60`} strokeWidth={1} />
                    {/* Icon */}
                    <text x={26} y={31} textAnchor="middle" fontSize={18} fontFamily="system-ui">{conf.icon}</text>
                    {/* Label */}
                    <foreignObject x={50} y={6} width={64} height={48}>
                      <div style={{ display: 'flex', alignItems: 'center', height: '100%', overflow: 'hidden' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#f2f3f5', lineHeight: 1.3, wordBreak: 'break-word', fontFamily: 'system-ui' }}>{node.label}</span>
                      </div>
                    </foreignObject>
                    {/* Selection ring */}
                    {isSelected && <rect x={-4} y={-4} width={128} height={68} rx={13} fill="none" stroke="#4a90d9" strokeWidth={1} strokeDasharray="4 2" opacity={0.6} />}
                    {/* Connect handle */}
                    {isSelected && !connecting && (
                      <circle cx={120} cy={30} r={7} fill="#4a90d9" stroke="#fff" strokeWidth={1.5}
                        style={{ cursor: 'pointer' }}
                        onMouseDown={e => { e.stopPropagation(); setConnecting(node.id) }} />
                    )}
                  </g>
                )
              })}
            </g>

            {/* Hint */}
            {nodes.length === 0 && (
              <text x="50%" y="50%" textAnchor="middle" fill="#3f4348" fontSize={15} fontFamily="system-ui">Click a component above to add it to the canvas</text>
            )}
          </svg>
        </div>

        {/* Properties panel */}
        {selectedNodeData && (
          <div style={{ width: 220, background: '#222529', borderLeft: '1px solid #2a2d31', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f2f3f5' }}>Properties</div>
            <div>
              <label style={pLbl}>Label</label>
              <input value={selectedNodeData.label}
                onChange={e => setNodes(prev => prev.map(n => n.id === selectedNode ? { ...n, label: e.target.value } : n))}
                style={pInp} />
            </div>
            <div>
              <label style={pLbl}>Color</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['#5865f2','#4a90d9','#2eb67d','#ed4245','#faa61a','#e8912d','#7b2d8b','#e91e8c','#72767d'].map(c => (
                  <div key={c} onClick={() => setNodes(prev => prev.map(n => n.id === selectedNode ? { ...n, color: c } : n))}
                    style={{ width: 22, height: 22, borderRadius: 4, background: c, cursor: 'pointer', border: selectedNodeData.color === c ? '2px solid #fff' : '2px solid transparent' }} />
                ))}
              </div>
            </div>
            <div>
              <label style={pLbl}>Description</label>
              <textarea value={selectedNodeData.description || ''}
                onChange={e => setNodes(prev => prev.map(n => n.id === selectedNode ? { ...n, description: e.target.value } : n))}
                rows={3} placeholder="Optional notes…"
                style={{ ...pInp, resize: 'none', lineHeight: 1.4 }} />
            </div>
            <button onClick={deleteSelected}
              style={{ background: 'rgba(237,66,69,.1)', border: '1px solid rgba(237,66,69,.3)', borderRadius: 6, padding: '7px', color: '#ed4245', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Trash2 size={13} /> Delete node
            </button>
          </div>
        )}

        {selectedConn && (() => {
          const conn = connections.find(c => c.id === selectedConn)!
          return (
            <div style={{ width: 220, background: '#222529', borderLeft: '1px solid #2a2d31', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f2f3f5' }}>Connection</div>
              <div>
                <label style={pLbl}>Label</label>
                <input value={conn.label || ''}
                  onChange={e => setConnections(prev => prev.map(c => c.id === selectedConn ? { ...c, label: e.target.value } : c))}
                  placeholder="e.g. HTTPS, SQL" style={pInp} />
              </div>
              <div>
                <label style={pLbl}>Style</label>
                <select value={conn.style} onChange={e => setConnections(prev => prev.map(c => c.id === selectedConn ? { ...c, style: e.target.value as ConnectorStyle } : c))}
                  style={{ ...pInp, cursor: 'pointer' }}>
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </select>
              </div>
              <div>
                <label style={pLbl}>Color</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['#72767d','#4a90d9','#2eb67d','#ed4245','#faa61a','#e91e8c','#f2f3f5'].map(c => (
                    <div key={c} onClick={() => setConnections(prev => prev.map(cn => cn.id === selectedConn ? { ...cn, color: c } : cn))}
                      style={{ width: 22, height: 22, borderRadius: 4, background: c, cursor: 'pointer', border: conn.color === c ? '2px solid #fff' : '2px solid transparent' }} />
                  ))}
                </div>
              </div>
              <button onClick={deleteSelected}
                style={{ background: 'rgba(237,66,69,.1)', border: '1px solid rgba(237,66,69,.3)', borderRadius: 6, padding: '7px', color: '#ed4245', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Trash2 size={13} /> Delete connection
              </button>
            </div>
          )
        })()}
      </div>

      {/* Instructions */}
      <div style={{ padding: '6px 16px', background: '#0f1113', borderTop: '1px solid #2a2d31', display: 'flex', gap: 16, flexShrink: 0, overflowX: 'auto' }}>
        {['Click icon to add node', 'Drag to move', 'Double-click to edit', 'Select + 🔗 to connect', 'Click connector to edit', 'Del to delete', 'Alt+drag to pan', 'Ctrl+S to save'].map((h, i) => (
          <span key={i} style={{ fontSize: 11, color: '#3f4348', whiteSpace: 'nowrap' }}>{h}</span>
        ))}
      </div>
    </div>
  )
}

const toolBtn: React.CSSProperties = { width: 30, height: 30, borderRadius: 6, border: '1px solid #3f4348', background: '#2c2f33', color: '#b9bbbe', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const pLbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#72767d', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }
const pInp: React.CSSProperties = { width: '100%', background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 5, padding: '6px 8px', color: '#f2f3f5', fontSize: 13, outline: 'none', fontFamily: 'inherit' }
