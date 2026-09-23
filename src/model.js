const cleanData = (data = {}) => {
  const { symbol, ...rest } = data;
  return rest;
};

export function snapshotForStorage(nodes, edges, meta) {
  return {
    schemaVersion: 'block-diagram-react-flow-v1',
    meta,
    nodes: nodes.map((n) => ({ ...n, data: cleanData(n.data) })),
    edges: edges.map((e) => ({ ...e })),
  };
}

export function exportLegacyCompatibleProject(nodes, edges, meta) {
  const devices = nodes.filter((n) => n.type === 'telecom').map((n) => ({
    id: n.id,
    presetId: n.data.presetId || undefined,
    type: n.data.deviceType || 'Preset Symbol',
    tag: n.data.tag || n.id,
    x: n.position.x,
    y: n.position.y,
    quantity: Number(n.data.quantity || 1),
    scale: Number(n.data.scale || 1),
    description: n.data.description || '',
    status: n.data.status || 'Active',
    metadata: { ...(n.data.metadata || {}), sourceRef: n.data.sourceRef || n.data.metadata?.sourceRef || '' },
  }));
  const zones = nodes.filter((n) => n.type === 'zone').map((n) => ({
    id: n.id,
    label: n.data.label || 'ZONE',
    description: n.data.description || n.data.label || '',
    x: n.position.x,
    y: n.position.y,
    w: n.width || n.style?.width || 500,
    h: n.height || n.style?.height || 300,
    lineStyle: 'dashed',
    lineWidth: 2,
    lineColor: '#0369a1',
    fillColor: '#ecfeff10',
    radius: 4,
  }));
  const notes = nodes.filter((n) => n.type === 'note').map((n) => ({
    id: n.id,
    kind: 'Text',
    text: n.data.text || '',
    x: n.position.x,
    y: n.position.y,
    fontSize: n.data.fontSize || 11,
    fontWeight: n.data.fontWeight || '700',
    color: n.data.color || '#111827',
  }));
  const links = edges.map((e) => ({
    id: e.id,
    from: e.source,
    to: e.target,
    label: e.label || e.data?.label || e.id,
    vertices: e.data?.vertices || [],
    lineColor: e.style?.stroke || '#2563eb',
    lineStyle: e.data?.lineStyle || 'solid',
    lineWidth: e.style?.strokeWidth || 2.5,
    medium: e.data?.medium || '',
    service: e.data?.service || '',
    status: e.data?.status || 'Connected',
    fromPort: e.sourceHandle || 'auto',
    toPort: e.targetHandle || 'auto',
    sourceRef: e.data?.sourceRef || '',
  }));
  return {
    meta,
    nodes: devices,
    links,
    notes,
    zones,
    customSymbols: [],
    grid: true,
    snap: true,
    reactFlow: snapshotForStorage(nodes, edges, meta),
  };
}

function legacyNodeToFlow(n) {
  return {
    id: n.id,
    type: 'telecom',
    position: { x: Number(n.x || 0), y: Number(n.y || 0) },
    data: {
      tag: n.tag || n.id,
      presetId: n.presetId || null,
      deviceType: n.type || 'Preset Symbol',
      quantity: Number(n.quantity || 1),
      scale: Number(n.scale || 1),
      description: n.description || '',
      status: n.status || 'Active',
      metadata: n.metadata || {},
      sourceRef: n.metadata?.sourceRef || '',
    },
  };
}

export function normalizeProject(raw) {
  if (raw?.reactFlow?.nodes && raw?.reactFlow?.edges) {
    return { meta: raw.reactFlow.meta || raw.meta || {}, nodes: raw.reactFlow.nodes, edges: raw.reactFlow.edges };
  }
  if (raw?.schemaVersion === 'block-diagram-react-flow-v1' && Array.isArray(raw.nodes) && Array.isArray(raw.edges)) {
    return { meta: raw.meta || {}, nodes: raw.nodes, edges: raw.edges };
  }
  if (Array.isArray(raw?.nodes) && Array.isArray(raw?.links)) {
    const nodes = raw.nodes.map(legacyNodeToFlow);
    (raw.zones || []).forEach((z) => nodes.unshift({
      id: z.id,
      type: 'zone',
      position: { x: Number(z.x || 0), y: Number(z.y || 0) },
      style: { width: Number(z.w || 500), height: Number(z.h || 300) },
      data: { label: z.label || 'ZONE', description: z.description || '' },
      zIndex: -10,
    }));
    (raw.notes || []).forEach((n) => nodes.push({
      id: n.id,
      type: 'note',
      position: { x: Number(n.x || 0), y: Number(n.y || 0) },
      data: { text: n.text || '', fontSize: n.fontSize || 11, fontWeight: n.fontWeight || '700', color: n.color || '#111827' },
    }));
    const edges = raw.links.map((l) => ({
      id: l.id,
      source: l.from,
      target: l.to,
      sourceHandle: l.fromPort === 'auto' ? undefined : l.fromPort,
      targetHandle: l.toPort === 'auto' ? undefined : l.toPort,
      type: 'smoothstep',
      label: l.label || l.id,
      style: { stroke: l.lineColor || '#2563eb', strokeWidth: Number(l.lineWidth || 2.5) },
      data: { medium: l.medium || '', service: l.service || '', status: l.status || 'Connected', sourceRef: l.sourceRef || '', vertices: l.vertices || [], lineStyle: l.lineStyle || 'solid' },
    }));
    return { meta: raw.meta || {}, nodes, edges };
  }
  throw new Error('Unsupported block diagram project format.');
}

export function downloadText(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

export function registerRows(nodes, edges) {
  const rows = [];
  nodes.filter((n) => n.type === 'telecom').forEach((n) => rows.push({
    id: n.id,
    type: 'Device',
    tag: n.data.tag || '',
    description: n.data.description || '',
    from: '', to: '', medium: '', service: '',
    status: n.data.status || '',
    subsystem: n.data.metadata?.subsystem || '',
    category: n.data.metadata?.category || '',
    materialId: n.data.metadata?.materialId || '',
    layer: n.data.metadata?.layer || '',
    sourceRef: n.data.sourceRef || n.data.metadata?.sourceRef || '',
  }));
  edges.forEach((e) => rows.push({
    id: e.id,
    type: 'Connection',
    tag: e.label || e.data?.label || '',
    description: 'Logical connection',
    from: nodes.find((n) => n.id === e.source)?.data?.tag || e.source,
    to: nodes.find((n) => n.id === e.target)?.data?.tag || e.target,
    medium: e.data?.medium || '',
    service: e.data?.service || '',
    status: e.data?.status || 'Connected',
    subsystem: '', category: '', materialId: '', layer: '',
    sourceRef: e.data?.sourceRef || '',
  }));
  return rows;
}

export function rowsToCsv(rows) {
  const headers = ['Record ID','Type','Tag / Link','Description','From','To','Medium','Signal / Service','Status','Subsystem','Category','Material ID','CAD Layer','Source Reference'];
  const keys = ['id','type','tag','description','from','to','medium','service','status','subsystem','category','materialId','layer','sourceRef'];
  const quote = (v) => '"' + String(v ?? '').replaceAll('"', '""') + '"';
  return [headers.map(quote).join(','), ...rows.map((r) => keys.map((k) => quote(r[k])).join(','))].join('\r\n');
}

export function validateDiagram(nodes, edges, sourceRefs = []) {
  const devices = nodes.filter((n) => n.type === 'telecom');
  const tags = new Map();
  devices.forEach((n) => tags.set(n.data.tag, (tags.get(n.data.tag) || 0) + 1));
  const duplicateTags = [...tags.entries()].filter(([tag, count]) => tag && count > 1).map(([tag]) => tag);
  const nodeIds = new Set(devices.map((n) => n.id));
  const brokenEdges = edges.filter((e) => !nodeIds.has(e.source) || !nodeIds.has(e.target));
  const degree = new Map(devices.map((n) => [n.id, 0]));
  edges.forEach((e) => { if (degree.has(e.source)) degree.set(e.source, degree.get(e.source) + 1); if (degree.has(e.target)) degree.set(e.target, degree.get(e.target) + 1); });
  const orphanNodes = devices.filter((n) => degree.get(n.id) === 0);
  const missingSource = sourceRefs.length ? devices.filter((n) => !(n.data.sourceRef || n.data.metadata?.sourceRef)) : [];
  return {
    errors: duplicateTags.length + brokenEdges.length,
    warnings: orphanNodes.length + missingSource.length,
    duplicateTags,
    brokenEdges,
    orphanNodes,
    missingSource,
  };
}
