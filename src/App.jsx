import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  Handle,
  Position,
  ConnectionMode,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
  NodeResizer,
  useReactFlow,
} from '@xyflow/react';
import presetSymbols from './generated/presetSymbols.json';
import { SOURCE_REFERENCES } from './data/sourceReferences.js';
import { TEMPLATE_SPECS } from './data/templates.js';
import {
  snapshotForStorage,
  exportLegacyCompatibleProject,
  normalizeProject,
  downloadText,
  registerRows,
  rowsToCsv,
  validateDiagram,
} from './model.js';

const STORAGE_KEY = 'hec_block_diagram_react_flow_v1';
const PRESET_MAP = new Map(presetSymbols.map((p) => [p.id, p]));
const SOURCE_MAP = new Map(SOURCE_REFERENCES.map((r) => [r.id, r]));
const uid = (prefix) => prefix + '-' + Math.random().toString(36).slice(2, 9).toUpperCase();

const HANDLE_CONFIG = [
  ['n', Position.Top, { left: '50%' }], ['ne', Position.Top, { left: '88%' }],
  ['e', Position.Right, { top: '50%' }], ['se', Position.Right, { top: '84%' }],
  ['s', Position.Bottom, { left: '50%' }], ['sw', Position.Bottom, { left: '12%' }],
  ['w', Position.Left, { top: '50%' }], ['nw', Position.Left, { top: '16%' }],
];

function TelecomNode({ data, selected }) {
  const preset = data.presetId ? PRESET_MAP.get(data.presetId) : null;
  const color = data.metadata?.color || preset?.metadata?.color || '#3b82f6';
  return (
    <div className={'telecom-node ' + (selected ? 'selected' : '')}>
      <NodeResizer isVisible={selected} minWidth={130} minHeight={82} />
      {HANDLE_CONFIG.map(([id, position, style]) => <Handle key={id} id={id} type="source" position={position} style={style} className="engineering-handle" />)}
      <div className="node-head">
        <span className="node-system">{data.metadata?.subsystem || data.deviceType || 'TELECOM'}</span>
        {Number(data.quantity || 1) > 1 && <span className="qty-badge">x{data.quantity}</span>}
      </div>
      <div className="node-symbol" style={{ color }}>
        {preset ? <svg viewBox={preset.viewBox || '0 0 64 64'} dangerouslySetInnerHTML={{ __html: preset.svg }} /> : <div className="generic-symbol">SW</div>}
      </div>
      <div className="node-tag">{data.tag || 'UNTAGGED'}</div>
      <div className="node-desc">{data.description || preset?.metadata?.description || ''}</div>
    </div>
  );
}

function ZoneNode({ data, selected }) {
  return (
    <div className={'zone-node ' + (selected ? 'selected' : '')}>
      <NodeResizer isVisible={selected} minWidth={240} minHeight={160} />
      <strong>{data.label || 'ZONE'}</strong>
      <span>{data.description || ''}</span>
    </div>
  );
}

function NoteNode({ data }) {
  return <div className="note-node" style={{ color: data.color || '#fde68a', fontSize: data.fontSize || 11, fontWeight: data.fontWeight || 700 }}>{data.text}</div>;
}

const nodeTypes = { telecom: TelecomNode, zone: ZoneNode, note: NoteNode };

function buildTemplate(key) {
  const spec = TEMPLATE_SPECS[key];
  const primary = SOURCE_MAP.get(spec.meta.sourceRefs[0])?.documentNo || '';
  const zones = spec.zones.map((z) => ({
    id: z.id, type: 'zone', position: { x: z.x, y: z.y }, style: { width: z.width, height: z.height },
    data: { label: z.label, description: z.label }, zIndex: -10,
  }));
  const nodes = spec.nodes.map(([id, presetId, tag, x, y]) => {
    const preset = presetId ? PRESET_MAP.get(presetId) : null;
    return {
      id, type: 'telecom', position: { x, y },
      data: {
        tag, presetId, deviceType: preset ? 'Preset Symbol' : 'Network Core', quantity: 1, scale: 1,
        description: preset?.metadata?.description || tag, status: 'Active',
        metadata: { ...(preset?.metadata || {}), sourceRef: primary }, sourceRef: primary,
      },
    };
  });
  const edges = spec.edges.map(([id, source, target, label, medium, service, color]) => ({
    id, source, target, type: 'smoothstep', label,
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color },
    style: { stroke: color, strokeWidth: 2.5 },
    data: { medium, service, status: 'Connected', sourceRef: primary, lineStyle: 'solid' },
  }));
  return { nodes: [...zones, ...nodes], edges, meta: { ...spec.meta, client: 'PROJECT CLIENT', contractor: 'ENGINEERING CONTRACTOR' } };
}

function PropertiesPanel({ selection, nodes, edges, setNodes, setEdges }) {
  if (!selection) return <aside className="properties"><h3>Properties</h3><div className="muted">Select a device, zone, note, or connection.</div></aside>;
  if (selection.kind === 'node') {
    const node = nodes.find((n) => n.id === selection.id);
    if (!node) return null;
    if (node.type === 'zone') {
      const change = (field, value) => setNodes((prev) => prev.map((n) => n.id === node.id ? { ...n, data: { ...n.data, [field]: value } } : n));
      return <aside className="properties"><h3>Zone</h3><Field label="Name" value={node.data.label || ''} onChange={(v) => change('label', v)} /><Field label="Description" value={node.data.description || ''} onChange={(v) => change('description', v)} /></aside>;
    }
    if (node.type === 'note') return <aside className="properties"><h3>Note</h3><Field label="Text" value={node.data.text || ''} onChange={(v) => setNodes((p) => p.map((n) => n.id === node.id ? { ...n, data: { ...n.data, text: v } } : n))} /></aside>;
    const update = (field, value) => setNodes((prev) => prev.map((n) => n.id === node.id ? { ...n, data: { ...n.data, [field]: value } } : n));
    const updateMeta = (field, value) => setNodes((prev) => prev.map((n) => n.id === node.id ? { ...n, data: { ...n.data, metadata: { ...(n.data.metadata || {}), [field]: value }, ...(field === 'sourceRef' ? { sourceRef: value } : {}) } } : n));
    return (
      <aside className="properties">
        <h3>Device</h3>
        <Field label="Tag" value={node.data.tag || ''} onChange={(v) => update('tag', v)} />
        <Field label="Description" value={node.data.description || ''} onChange={(v) => update('description', v)} />
        <Field label="Quantity" type="number" value={node.data.quantity || 1} onChange={(v) => update('quantity', Number(v || 1))} />
        <Field label="Status" value={node.data.status || ''} onChange={(v) => update('status', v)} />
        <div className="section-title">Engineering metadata</div>
        <Field label="Subsystem" value={node.data.metadata?.subsystem || ''} onChange={(v) => updateMeta('subsystem', v)} />
        <Field label="Material ID" value={node.data.metadata?.materialId || ''} onChange={(v) => updateMeta('materialId', v)} />
        <Field label="CAD Layer" value={node.data.metadata?.layer || ''} onChange={(v) => updateMeta('layer', v)} />
        <Field label="Source Reference" value={node.data.sourceRef || node.data.metadata?.sourceRef || ''} onChange={(v) => updateMeta('sourceRef', v)} />
      </aside>
    );
  }
  const edge = edges.find((e) => e.id === selection.id);
  if (!edge) return null;
  const updateEdge = (field, value) => setEdges((prev) => prev.map((e) => e.id === edge.id ? { ...e, data: { ...(e.data || {}), [field]: value }, ...(field === 'label' ? { label: value } : {}) } : e));
  return <aside className="properties"><h3>Connection</h3><Field label="Link ID / Label" value={edge.label || ''} onChange={(v) => updateEdge('label', v)} /><Field label="Medium" value={edge.data?.medium || ''} onChange={(v) => updateEdge('medium', v)} /><Field label="Service" value={edge.data?.service || ''} onChange={(v) => updateEdge('service', v)} /><Field label="Source Reference" value={edge.data?.sourceRef || ''} onChange={(v) => updateEdge('sourceRef', v)} /></aside>;
}

function Field({ label, value, onChange, type = 'text' }) {
  return <label className="field"><span>{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function SourceDialog({ open, meta, setMeta, onClose }) {
  if (!open) return null;
  const current = new Set(meta.sourceRefs || []);
  const toggle = (id, checked) => {
    const next = new Set(current); checked ? next.add(id) : next.delete(id); setMeta((m) => ({ ...m, sourceRefs: [...next] }));
  };
  return <div className="modal-backdrop"><div className="modal-card"><div className="modal-head"><h2>Project Source References</h2><button onClick={onClose}>Close</button></div><p>These references are saved with the diagram and used as provenance for new devices.</p><div className="source-list">{SOURCE_REFERENCES.map((r) => <label className="source-card" key={r.id}><input type="checkbox" checked={current.has(r.id)} onChange={(e) => toggle(r.id, e.target.checked)} /><span><strong>{r.documentNo} · {r.category}</strong><small>{r.title}</small></span></label>)}</div></div></div>;
}

function RegisterView({ nodes, edges }) {
  const rows = registerRows(nodes, edges);
  return <div className="register-view"><table><thead><tr>{['Record ID','Type','Tag / Link','Description','From','To','Medium','Signal / Service','Status','Subsystem','Category','Material ID','CAD Layer','Source Reference'].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r) => <tr key={r.type + r.id}>{[r.id,r.type,r.tag,r.description,r.from,r.to,r.medium,r.service,r.status,r.subsystem,r.category,r.materialId,r.layer,r.sourceRef].map((v, i) => <td key={i}>{v}</td>)}</tr>)}</tbody></table></div>;
}

export default function App() {
  const flow = useReactFlow();
  const initial = useMemo(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return normalizeProject(JSON.parse(saved));
    } catch (error) { console.warn(error); }
    return buildTemplate('PAGA');
  }, []);
  const [nodes, setNodes] = useState(initial.nodes);
  const [edges, setEdges] = useState(initial.edges);
  const [meta, setMeta] = useState(initial.meta);
  const [selection, setSelection] = useState(null);
  const [activeTab, setActiveTab] = useState('diagram');
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteSubsystem, setPaletteSubsystem] = useState('');
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const fileInputRef = useRef(null);
  const historyRef = useRef({ stack: [], index: -1 });
  const restoringRef = useRef(false);

  const subsystems = useMemo(() => [...new Set(presetSymbols.map((p) => p.metadata?.subsystem).filter(Boolean))].sort(), []);
  const palette = useMemo(() => presetSymbols.filter((p) => {
    const text = (p.name + ' ' + (p.metadata?.description || '') + ' ' + (p.metadata?.boq || '')).toLowerCase();
    return (!paletteSubsystem || p.metadata?.subsystem === paletteSubsystem) && (!paletteQuery || text.includes(paletteQuery.toLowerCase()));
  }).slice(0, 300), [paletteQuery, paletteSubsystem]);
  const activeSources = useMemo(() => (meta.sourceRefs || []).map((id) => SOURCE_MAP.get(id)).filter(Boolean), [meta.sourceRefs]);
  const validation = useMemo(() => validateDiagram(nodes, edges, meta.sourceRefs || []), [nodes, edges, meta.sourceRefs]);

  const recordHistory = useCallback((n = nodes, e = edges, m = meta) => {
    if (restoringRef.current) { restoringRef.current = false; return; }
    const json = JSON.stringify(snapshotForStorage(n, e, m));
    const h = historyRef.current;
    if (h.index >= 0 && h.stack[h.index] === json) return;
    h.stack.splice(h.index + 1);
    h.stack.push(json);
    if (h.stack.length > 60) h.stack.shift();
    h.index = h.stack.length - 1;
  }, [nodes, edges, meta]);

  useEffect(() => {
    const id = setTimeout(() => recordHistory(nodes, edges, meta), 280);
    const storageId = setTimeout(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshotForStorage(nodes, edges, meta))), 300);
    return () => { clearTimeout(id); clearTimeout(storageId); };
  }, [nodes, edges, meta, recordHistory]);

  const restoreHistory = useCallback((direction) => {
    const h = historyRef.current;
    const nextIndex = h.index + direction;
    if (nextIndex < 0 || nextIndex >= h.stack.length) return;
    h.index = nextIndex;
    restoringRef.current = true;
    const snap = JSON.parse(h.stack[h.index]);
    setNodes(snap.nodes); setEdges(snap.edges); setMeta(snap.meta || {}); setSelection(null);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); restoreHistory(e.shiftKey ? 1 : -1); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); restoreHistory(1); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [restoreHistory]);

  const onNodesChange = useCallback((changes) => setNodes((prev) => applyNodeChanges(changes, prev)), []);
  const onEdgesChange = useCallback((changes) => setEdges((prev) => applyEdgeChanges(changes, prev)), []);
  const onConnect = useCallback((connection) => {
    const primary = activeSources[0]?.documentNo || '';
    setEdges((prev) => addEdge({ ...connection, id: uid('LINK'), type: 'smoothstep', label: 'NEW LINK', style: { stroke: '#2563eb', strokeWidth: 2.5 }, markerEnd: { type: MarkerType.ArrowClosed }, data: { medium: '', service: '', status: 'Connected', sourceRef: primary } }, prev));
  }, [activeSources]);

  const addPresetAt = useCallback((presetId, position) => {
    const preset = PRESET_MAP.get(presetId); if (!preset) return;
    const primary = activeSources[0]?.documentNo || '';
    setNodes((prev) => [...prev, { id: uid('DEV'), type: 'telecom', position, data: { tag: 'NEW-' + (preset.metadata?.boq || 'DEVICE'), presetId, deviceType: 'Preset Symbol', quantity: 1, scale: 1, description: preset.metadata?.description || preset.name, status: 'Active', metadata: { ...(preset.metadata || {}), sourceRef: primary }, sourceRef: primary } }]);
  }, [activeSources]);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const presetId = event.dataTransfer.getData('application/block-diagram-preset');
    if (!presetId) return;
    addPresetAt(presetId, flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  }, [addPresetAt, flow]);

  const loadTemplate = (key) => {
    const project = buildTemplate(key); setNodes(project.nodes); setEdges(project.edges); setMeta(project.meta); setSelection(null); setActiveTab('diagram'); setTimeout(() => flow.fitView({ padding: 0.15, duration: 300 }), 0);
  };

  const exportJson = () => {
    const project = exportLegacyCompatibleProject(nodes, edges, meta);
    downloadText((meta.documentNo || 'Telecom_Block_Diagram') + '.json', JSON.stringify(project, null, 2));
  };
  const exportCsv = () => downloadText('Block_Diagram_Register.csv', rowsToCsv(registerRows(nodes, edges)), 'text/csv');
  const importFile = async (file) => {
    const raw = JSON.parse(await file.text()); const project = normalizeProject(raw);
    setNodes(project.nodes); setEdges(project.edges); setMeta(project.meta || {}); setSelection(null); setActiveTab('diagram'); setTimeout(() => flow.fitView({ padding: 0.15 }), 0);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="logo">HEC</span><div><strong>Telecom Block Diagram Maker</strong><small>React Flow migration · source-aware engineering editor</small></div></div>
        <div className="top-actions">
          <button className={activeTab === 'diagram' ? 'active' : ''} onClick={() => setActiveTab('diagram')}>Diagram</button>
          <button className={activeTab === 'register' ? 'active' : ''} onClick={() => setActiveTab('register')}>Register</button>
          <button onClick={() => restoreHistory(-1)}>Undo</button><button onClick={() => restoreHistory(1)}>Redo</button>
          <button onClick={() => setSourcesOpen(true)}>Sources</button>
          <button onClick={exportJson}>Export JSON</button><button onClick={exportCsv}>CSV</button>
          <button onClick={() => fileInputRef.current?.click()}>Import</button>
          <input ref={fileInputRef} hidden type="file" accept="application/json" onChange={(e) => { if (e.target.files?.[0]) importFile(e.target.files[0]).catch((err) => alert(err.message)); e.target.value = ''; }} />
        </div>
      </header>
      <div className="template-bar">
        <span>Source-based starters</span>{Object.entries(TEMPLATE_SPECS).map(([key, spec]) => <button key={key} onClick={() => loadTemplate(key)}>{spec.label}</button>)}
        <div className="template-meta"><strong>{meta.documentNo || 'UNNUMBERED'}</strong><span>{meta.title || 'SYSTEM BLOCK DIAGRAM'}</span></div>
      </div>
      {activeTab === 'register' ? <RegisterView nodes={nodes} edges={edges} /> : <div className="editor-grid">
        <aside className="palette-panel">
          <h3>Preset Symbol Library</h3>
          <input placeholder={'Search ' + presetSymbols.length + ' symbols'} value={paletteQuery} onChange={(e) => setPaletteQuery(e.target.value)} />
          <select value={paletteSubsystem} onChange={(e) => setPaletteSubsystem(e.target.value)}><option value="">All subsystems</option>{subsystems.map((s) => <option key={s}>{s}</option>)}</select>
          <div className="palette-count">{palette.length} shown</div>
          <div className="palette-list">{palette.map((p) => <div className="palette-item" key={p.id} draggable onDragStart={(e) => e.dataTransfer.setData('application/block-diagram-preset', p.id)} onDoubleClick={() => addPresetAt(p.id, flow.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }))}><div className="palette-icon" style={{ color: p.metadata?.color || '#3b82f6' }}><svg viewBox={p.viewBox || '0 0 64 64'} dangerouslySetInnerHTML={{ __html: p.svg }} /></div><div><strong>{p.name}</strong><small>{p.metadata?.subsystem} · {p.metadata?.boq}</small></div></div>)}</div>
        </aside>
        <main className="flow-wrap" onDrop={onDrop} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}>
          <ReactFlow
            nodes={nodes} edges={edges} nodeTypes={nodeTypes}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
            onSelectionChange={({ nodes: selectedNodes, edges: selectedEdges }) => setSelection(selectedNodes[0] ? { kind: 'node', id: selectedNodes[0].id } : selectedEdges[0] ? { kind: 'edge', id: selectedEdges[0].id } : null)}
            connectionMode={ConnectionMode.Loose}
            selectionOnDrag panOnDrag={[1, 2]} multiSelectionKeyCode="Shift" deleteKeyCode={['Backspace', 'Delete']}
            snapToGrid snapGrid={[20, 20]} fitView fitViewOptions={{ padding: 0.16 }}
            defaultEdgeOptions={{ type: 'smoothstep', pathOptions: { borderRadius: 0 } }}
          >
            <Background id="fine" variant={BackgroundVariant.Lines} gap={20} color="#1d2b40" />
            <Background id="major" variant={BackgroundVariant.Lines} gap={100} color="#2b466b" />
            <Controls position="bottom-left" />
            <MiniMap pannable zoomable position="bottom-right" nodeColor={(n) => n.type === 'zone' ? '#334155' : '#2563eb'} />
            <Panel position="top-left" className="source-banner">{activeSources.length ? 'SOURCE BASIS: ' + activeSources.map((s) => s.documentNo).join(' · ') : 'NO PROJECT SOURCE ATTACHED'}</Panel>
            <Panel position="bottom-center" className={'validation-banner ' + (validation.errors ? 'bad' : validation.warnings ? 'warn' : 'ok')}>{validation.errors} errors · {validation.warnings} warnings</Panel>
          </ReactFlow>
        </main>
        <PropertiesPanel selection={selection} nodes={nodes} edges={edges} setNodes={setNodes} setEdges={setEdges} />
      </div>}
      <footer className="statusbar"><span>{nodes.filter((n) => n.type === 'telecom').length} devices · {edges.length} connections · {presetSymbols.length} presets</span><a href="./Telecom_Block_Diagram_Maker_CAD_Editing_V19.html">Open legacy CAD editor / PDF-SVG-DXF export</a></footer>
      <SourceDialog open={sourcesOpen} meta={meta} setMeta={setMeta} onClose={() => setSourcesOpen(false)} />
    </div>
  );
}
