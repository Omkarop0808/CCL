import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Play, RefreshCw, StepBack, StepForward, Volume2, VolumeX, Sparkles, Activity } from 'lucide-react';
import api from '../../utils/api';
import ExecutionAnimator from '../../components/ExecutionAnimator';

const SPEEDS = [
  { label: '0.25x', ms: 1400 },
  { label: '0.5x', ms: 900 },
  { label: '1x', ms: 500 },
  { label: '2x', ms: 260 },
  { label: '4x', ms: 150 },
];

const RECENT_KEY = 'career-visualizer-recent-v1';

function safeSpeak(text, { enabled, voiceName } = {}) {
  return new Promise((resolve) => {
    if (!enabled || typeof window === 'undefined') {
      return resolve();
    }
    const synth = window.speechSynthesis;
    if (!synth) {
      return resolve();
    }
    
    synth.cancel();
    
    const u = new SpeechSynthesisUtterance(String(text || '').slice(0, 2000));
    const voices = synth.getVoices?.() || [];
    const picked = voiceName ? voices.find((v) => v.name === voiceName) : null;
    if (picked) u.voice = picked;
    
    u.rate = 1.0;
    u.pitch = 1.0;
    
    u.onend = () => resolve();
    u.onerror = () => resolve();
    
    synth.speak(u);
    
    // Safety fallback: if onend doesn't fire, resolve after estimated time
    const wordCount = String(text || '').split(/\s+/).length;
    const estimatedMs = Math.max(1000, wordCount * 300);
    setTimeout(resolve, estimatedMs + 500);
  });
}

// ... skipped normalizeStep, sanitizeAnalysis, readRecent, writeRecent
function normalizeStep(step, i) {
  const fallback = `Step ${i + 1}`;
  const state = step?.state || {};
  return {
    label: String(step?.label || fallback),
    stepText: String(step?.stepText || ''),
    voiceText: String(step?.voiceText || ''),
    state: {
      array: Array.isArray(state.array) ? state.array : [],
      pointers: Array.isArray(state.pointers) ? state.pointers : [],
      window: state.window && typeof state.window === 'object' ? state.window : null,
      stack: Array.isArray(state.stack) ? state.stack : [],
      queue: Array.isArray(state.queue) ? state.queue : [],
      graph: state.graph && typeof state.graph === 'object' ? state.graph : null,
      tree: state.tree && typeof state.tree === 'object' ? state.tree : null,
    },
  };
}

function sanitizeAnalysis(raw) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  const steps = Array.isArray(safe?.visualization?.steps) ? safe.visualization.steps.slice(0, 120).map(normalizeStep) : [];
  
  let finalObj = safe.final && typeof safe.final === 'object' ? safe.final : {};
  
  if (!finalObj.code) {
      finalObj.code = safe.code || safe.solution || safe.python_code || '# Code missing from AI response.\n# You can use the Tracer and write your own code to visualize execution.';
  }
  if (!finalObj.complexity || Object.keys(finalObj.complexity).length === 0) {
      finalObj.complexity = safe.complexity || { time: safe.time || 'N/A', space: safe.space || 'N/A', explain: safe.explain || '' };
  }
  if (!finalObj.similar || !Array.isArray(finalObj.similar)) {
      finalObj.similar = Array.isArray(safe.similar) ? safe.similar : [];
  }

  return {
    problem: safe.problem && typeof safe.problem === 'object' ? safe.problem : null,
    pattern: safe.pattern && typeof safe.pattern === 'object' ? safe.pattern : null,
    visualization: {
      steps,
      primaryStructure: String(safe?.visualization?.primaryStructure || 'mixed'),
    },
    final: finalObj,
  };
}

function readRecent() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [];
  }
}

function writeRecent(items) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, 6)));
}

function ArrayViz({ array = [], pointers = [], window }) {
  return (
    <div className="w-full overflow-x-auto py-8">
      <div className="inline-flex gap-4 items-end">
        <AnimatePresence>
          {array.map((cell, idx) => {
            const hl = cell.highlight || 'none';
            const bg =
              hl === 'active'
                ? 'linear-gradient(135deg, rgba(6,182,212,0.9), rgba(6,182,212,0.5))'
                : hl === 'compare'
                  ? 'linear-gradient(135deg, rgba(139,92,246,0.9), rgba(139,92,246,0.5))'
                  : hl === 'swap'
                    ? 'linear-gradient(135deg, rgba(239,68,68,0.9), rgba(239,68,68,0.5))'
                    : hl === 'window'
                      ? 'linear-gradient(135deg, rgba(34,197,94,0.7), rgba(34,197,94,0.3))'
                      : 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))';
            
            const shadow = hl !== 'none' && hl !== 'window' ? `0 8px 16px ${bg.split(',')[1].replace('0.9', '0.3')}` : '0 4px 6px rgba(0,0,0,0.1)';

            const pointerMarks = pointers.filter((p) => Number(p.index) === idx);
            const rawValue = String(cell.value ?? '');
            const valueLower = rawValue.toLowerCase();
            const boolLike = valueLower === 'true' || valueLower === 'false' || valueLower === 't' || valueLower === 'f';
            const inWindow = window && idx >= Number(window.l) && idx <= Number(window.r);
            
            return (
              <motion.div
                key={`${idx}-${rawValue}`}
                initial={{ opacity: 0, y: -20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="h-6 flex items-end">
                  {pointerMarks.length ? (
                    <motion.div 
                      initial={{ y: -10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="flex gap-1 bg-slate-800 px-2 py-1 rounded-md shadow-lg border border-slate-700"
                    >
                      {pointerMarks.slice(0, 2).map((p) => (
                        <div
                          key={`${p.name}-${idx}`}
                          className="text-[10px] font-extrabold"
                          style={{ color: p.color || '#06b6d4' }}
                        >
                          {p.name}
                        </div>
                      ))}
                    </motion.div>
                  ) : null}
                </div>
                
                <motion.div
                  whileHover={{ scale: 1.1, y: -5 }}
                  className="w-16 h-16 rounded-xl flex items-center justify-center font-mono text-xl font-bold text-white relative backdrop-blur-md border border-white/20"
                  style={{
                    background: inWindow ? 'linear-gradient(135deg, rgba(34,197,94,0.5), rgba(34,197,94,0.1))' : bg,
                    boxShadow: shadow,
                  }}
                  title={`idx ${idx}`}
                >
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-white/10 to-transparent" />
                  <span style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                    {boolLike ? (valueLower.startsWith('t') ? 'T' : 'F') : rawValue}
                  </span>
                </motion.div>
                
                <div className="text-[11px] text-slate-400 font-mono font-bold bg-slate-900/50 px-2 rounded-full border border-slate-800 shadow-inner">
                  {idx}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StackViz({ stack = [], title = 'Stack' }) {
  return (
    <div className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-6 overflow-hidden relative">
      <div className="font-semibold text-white mb-8 relative z-10 flex items-center gap-2">
        <Activity size={16} className="text-violet-400" /> {title}
      </div>
      <div className="flex flex-col-reverse items-center gap-1 mt-4">
        <AnimatePresence>
          {(stack || []).slice(0, 12).map((v, idx) => (
            <motion.div
              key={`${v}-${idx}`}
              initial={{ opacity: 0, y: -40, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25, delay: idx * 0.05 }}
              className="w-40 py-3 rounded-lg flex justify-center items-center font-mono text-sm font-bold text-white relative backdrop-blur-md border border-white/20 shadow-lg"
              style={{
                background: 'linear-gradient(145deg, rgba(139,92,246,0.6), rgba(139,92,246,0.2))'
              }}
            >
              <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-black/20 to-transparent" />
              <span style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{String(v)}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {!stack?.length ? (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
            className="text-sm text-slate-500 font-medium h-24 flex items-center justify-center border-2 border-dashed border-slate-700/50 rounded-xl w-40"
          >
            Empty Stack
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}

function QueueViz({ queue = [], title = 'Queue' }) {
  return (
    <div className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-6 overflow-hidden relative">
      <div className="font-semibold text-white mb-4 relative z-10 flex items-center gap-2">
        <Activity size={16} className="text-cyan-400" /> {title}
      </div>
      <div className="flex flex-wrap gap-4 mt-8">
        <AnimatePresence>
          {(queue || []).slice(0, 16).map((v, idx) => (
            <motion.div
              key={`${v}-${idx}`}
              initial={{ opacity: 0, x: 50, scale: 0.5 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -50, scale: 0.5 }}
              transition={{ type: 'spring', stiffness: 350, damping: 20, delay: idx * 0.05 }}
              className="w-16 h-16 rounded-xl flex items-center justify-center font-mono text-lg font-bold text-white relative backdrop-blur-md border border-white/20 shadow-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(6,182,212,0.6), rgba(6,182,212,0.2))'
              }}
            >
              <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-white/10 to-transparent" />
              <span style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{String(v)}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {!queue?.length ? (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
            className="text-sm text-slate-500 font-medium h-16 flex items-center justify-center border-2 border-dashed border-slate-700/50 rounded-xl px-8"
          >
            Empty Queue
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}

function buildGraphFallback(step, primaryStructure = 'mixed') {
  const state = step?.state || {};
  const fromGraph = state.graph && Array.isArray(state.graph.nodes) && state.graph.nodes.length
    ? state.graph
    : null;
  if (fromGraph) return fromGraph;

  const isGraphLike = primaryStructure === 'graph' || /graph|bfs|dfs|node|adjacency/i.test(`${step?.label || ''} ${step?.stepText || ''}`);
  if (!isGraphLike) return null;

  const array = Array.isArray(state.array) ? state.array : [];
  if (!array.length && !state.queue?.length && !state.stack?.length) return null;

  const pointers = Array.isArray(state.pointers) ? state.pointers : [];
  const activeIndex = pointers.find((p) => Number.isInteger(Number(p.index)))?.index;
  const frontier = new Set((state.queue || []).map((x) => Number(x)).filter(Number.isFinite));
  const values = array.map((cell) => String(cell?.value ?? ''));
  const nodes = values.map((v, i) => {
    const low = v.toLowerCase();
    const visited = low === 'true' || low === 't' || low === '1';
    let st = visited ? 'visited' : 'idle';
    if (frontier.has(i)) st = 'frontier';
    if (Number(activeIndex) === i) st = 'active';
    return { id: String(i), label: `${i}`, state: st };
  });

  return { nodes, edges: [], active: Number.isFinite(Number(activeIndex)) ? String(activeIndex) : '' };
}

function getJourneyCheckpoints(steps = []) {
  if (!steps.length) return [];
  if (steps.length <= 6) return steps.map((s, i) => ({ ...s, stepNo: i + 1 }));
  const mid = Math.floor(steps.length / 2);
  const picks = [0, 1, mid - 1, mid, steps.length - 2, steps.length - 1]
    .filter((x) => x >= 0 && x < steps.length);
  const uniq = Array.from(new Set(picks)).sort((a, b) => a - b);
  return uniq.map((i) => ({ ...steps[i], stepNo: i + 1 }));
}

function GraphViz({ graph }) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  if (!nodes.length) return <div className="text-sm text-white/60">No graph state in this step.</div>;

  const W = 560;
  const H = 280;
  const cx = W / 2;
  const cy = H / 2;
  const radius = Math.max(90, Math.min(120, Math.floor((Math.min(W, H) - 50) / 2)));

  const positions = new Map();
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
    positions.set(n.id, {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  });

  const nodeColor = (state) => {
    if (state === 'active') return 'linear-gradient(135deg, rgba(6,182,212,0.9), rgba(6,182,212,0.5))';
    if (state === 'frontier') return 'linear-gradient(135deg, rgba(139,92,246,0.9), rgba(139,92,246,0.5))';
    if (state === 'visited') return 'linear-gradient(135deg, rgba(34,197,94,0.9), rgba(34,197,94,0.5))';
    return 'linear-gradient(135deg, rgba(148,163,184,0.5), rgba(148,163,184,0.1))';
  };

  return (
    <div className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-6 overflow-hidden relative">
      <div className="font-semibold text-white relative z-10 flex items-center gap-2 mb-4">
        <Activity size={16} className="text-fuchsia-400" /> Graph State
      </div>
      
      <div className="relative w-full mx-auto" style={{ maxWidth: W, height: H }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 pointer-events-none">
          <AnimatePresence>
            {edges.map((e, i) => {
              const a = positions.get(e.from);
              const b = positions.get(e.to);
              if (!a || !b) return null;
              const isActiveEdge = graph?.active && (e.from === graph.active || e.to === graph.active);
              return (
                <motion.line
                  key={`${e.from}-${e.to}-${i}`}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: isActiveEdge ? 0.8 : 0.3 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={isActiveEdge ? '#06b6d4' : '#94a3b8'}
                  strokeWidth={isActiveEdge ? 4 : 2}
                  strokeLinecap="round"
                />
              );
            })}
          </AnimatePresence>
        </svg>

        {nodes.map((n, i) => {
          const p = positions.get(n.id);
          if (!p) return null;
          const isActive = n.id === graph?.active || n.state === 'active';
          
          return (
            <motion.div
              key={n.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: isActive ? 1.2 : 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: i * 0.05 }}
              className="absolute flex items-center justify-center rounded-full font-bold text-white shadow-lg backdrop-blur-md border border-white/30"
              style={{
                left: p.x - 20,
                top: p.y - 20,
                width: 40,
                height: 40,
                background: nodeColor(n.state),
                boxShadow: isActive ? '0 0 20px rgba(6,182,212,0.6)' : '0 4px 6px rgba(0,0,0,0.1)'
              }}
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-black/20 to-transparent" />
              <span style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                {String(n.label || n.id)}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function TreeViz({ tree }) {
  const nodes = Array.isArray(tree?.nodes) ? tree.nodes : [];
  const edges = Array.isArray(tree?.edges) ? tree.edges : [];
  if (!nodes.length) return <div className="text-sm text-white/60">No tree state in this step.</div>;

  const childSet = new Set(edges.map((e) => e.to));
  const rootId = nodes.find((n) => !childSet.has(n.id))?.id || nodes[0]?.id;
  const kids = new Map();
  edges.forEach((e) => {
    if (!kids.has(e.from)) kids.set(e.from, []);
    kids.get(e.from).push(e.to);
  });

  const levels = [];
  const seen = new Set();
  const q = [{ id: rootId, depth: 0 }];
  while (q.length) {
    const cur = q.shift();
    if (!cur || seen.has(cur.id)) continue;
    seen.add(cur.id);
    if (!levels[cur.depth]) levels[cur.depth] = [];
    levels[cur.depth].push(cur.id);
    const arr = kids.get(cur.id) || [];
    arr.forEach((id) => q.push({ id, depth: cur.depth + 1 }));
  }
  nodes.forEach((n) => {
    if (!seen.has(n.id)) {
      if (!levels[0]) levels[0] = [];
      levels[0].push(n.id);
    }
  });

  const W = 560;
  const H = Math.max(240, 120 + levels.length * 70);
  const positions = new Map();
  levels.forEach((row, depth) => {
    const y = 48 + depth * 70;
    row.forEach((id, i) => {
      const x = ((i + 1) * W) / (row.length + 1);
      positions.set(id, { x, y });
    });
  });

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const nodeColor = (state) => {
    if (state === 'active') return 'linear-gradient(135deg, rgba(6,182,212,0.9), rgba(6,182,212,0.5))';
    if (state === 'visited') return 'linear-gradient(135deg, rgba(34,197,94,0.9), rgba(34,197,94,0.5))';
    return 'linear-gradient(135deg, rgba(148,163,184,0.5), rgba(148,163,184,0.1))';
  };

  return (
    <div className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-6 overflow-hidden relative">
      <div className="font-semibold text-white relative z-10 flex items-center gap-2 mb-4">
        <Activity size={16} className="text-emerald-400" /> Tree State
      </div>
      
      <div className="relative w-full mx-auto" style={{ maxWidth: W, height: H }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 pointer-events-none">
          <AnimatePresence>
            {edges.map((e, i) => {
              const a = positions.get(e.from);
              const b = positions.get(e.to);
              if (!a || !b) return null;
              const isActiveEdge = tree?.active && (e.from === tree.active || e.to === tree.active);
              return (
                <motion.line
                  key={`${e.from}-${e.to}-${i}`}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: isActiveEdge ? 0.8 : 0.3 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={isActiveEdge ? '#06b6d4' : '#94a3b8'}
                  strokeWidth={isActiveEdge ? 4 : 2}
                  strokeLinecap="round"
                />
              );
            })}
          </AnimatePresence>
        </svg>

        {Array.from(positions.entries()).map(([id, p], i) => {
          const n = byId.get(id) || { id, label: id, state: 'idle' };
          const isActive = id === tree?.active || n.state === 'active';
          
          return (
            <motion.div
              key={id}
              initial={{ scale: 0, opacity: 0, y: -20 }}
              animate={{ scale: isActive ? 1.2 : 1, opacity: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: i * 0.05 }}
              className="absolute flex items-center justify-center rounded-full font-bold text-white shadow-lg backdrop-blur-md border border-white/30"
              style={{
                left: p.x - 20,
                top: p.y - 20,
                width: 40,
                height: 40,
                background: nodeColor(n.state),
                boxShadow: isActive ? '0 0 20px rgba(6,182,212,0.6)' : '0 4px 6px rgba(0,0,0,0.1)'
              }}
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 to-transparent" />
              <span style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                {String(n.label || n.id)}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default function AlgorithmVisualizer() {
  const [query, setQuery] = useState('https://leetcode.com/problems/two-sum/');
  const [language, setLanguage] = useState('python');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [data, setData] = useState(null);
  const [recentQueries, setRecentQueries] = useState(readRecent);
  const [voiceCache, setVoiceCache] = useState({});

  const [isTracing, setIsTracing] = useState(false);
  const [executionTrace, setExecutionTrace] = useState(null);

  const steps = data?.visualization?.steps || [];
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(500);
  const [muted, setMuted] = useState(false);

  const step = steps[Math.min(idx, Math.max(0, steps.length - 1))] || null;
  const maxIdx = Math.max(steps.length - 1, 0);
  const primaryStructure = data?.visualization?.primaryStructure || 'mixed';
  const graphData = useMemo(() => buildGraphFallback(step, primaryStructure), [step, primaryStructure]);
  const checkpoints = useMemo(() => getJourneyCheckpoints(steps), [steps]);
  const firstExample = data?.problem?.examples?.[0] || null;

  // Track if we are actively playing
  const isPlayingRef = useRef(playing);
  useEffect(() => {
    isPlayingRef.current = playing;
  }, [playing]);

  // Track the current index to avoid closure staleness
  const idxRef = useRef(idx);
  useEffect(() => {
    idxRef.current = idx;
  }, [idx]);

  // Async sequential playback loop
  useEffect(() => {
    if (!playing) return;
    let cancelled = false;

    const runLoop = async () => {
      while (isPlayingRef.current && !cancelled && idxRef.current < maxIdx) {
        // Find the current step
        const currentStep = steps[idxRef.current];
        if (!currentStep) break;

        // Determine what to speak
        let textToSpeak = currentStep.voiceText;
        if (!textToSpeak) {
          if (!voiceCache[idxRef.current] && data?.pattern?.name) {
            try {
              const res = await api.post('/career/visualizer/explain-step', {
                algoName: data.pattern.name,
                step: { label: currentStep.label, stepText: currentStep.stepText, state: currentStep.state },
              });
              textToSpeak = String(res?.data?.explanation || '').trim();
              setVoiceCache((prev) => ({ ...prev, [idxRef.current]: textToSpeak }));
            } catch {
              // Ignore
            }
          } else {
            textToSpeak = voiceCache[idxRef.current];
          }
        }

        // Wait for audio to finish + animation buffer speed
        if (textToSpeak && !muted) {
          await Promise.all([
            safeSpeak(textToSpeak, { enabled: true }),
            new Promise((r) => setTimeout(r, Math.max(120, speedMs)))
          ]);
        } else {
          await new Promise((r) => setTimeout(r, Math.max(120, speedMs * 2)));
        }

        if (cancelled || !isPlayingRef.current) break;

        // Move to next frame
        setIdx((i) => {
          const next = i + 1;
          if (next >= maxIdx) {
            setPlaying(false);
            return maxIdx;
          }
          return next;
        });
      }
    };

    runLoop();

    return () => {
      cancelled = true;
      if (window?.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, [playing, speedMs, muted, steps, maxIdx, data?.pattern?.name]);

  // Clean up speech on unmount
  useEffect(() => {
    return () => {
      if (window?.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (!steps.length) return;
    const handler = (e) => {
      const tag = e?.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(maxIdx, i + 1));
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
      if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [maxIdx, steps.length]);

  const analyze = async () => {
    const input = query.trim();
    if (!input) return;
    setLoading(true);
    setErr(null);
    setData(null);
    setIdx(0);
    setPlaying(false);
    setVoiceCache({});
    setExecutionTrace(null);
    setIsTracing(false);
    try {
      const res = await api.post('/career/visualizer/analyze', { input, language });
      const analysisData = sanitizeAnalysis(res.data);
      setData(analysisData);
      const nextRecent = [input, ...recentQueries.filter((x) => x !== input)].slice(0, 6);
      setRecentQueries(nextRecent);
      writeRecent(nextRecent);

      // Auto-trigger Python Tracer for full dry-run steps
      if (analysisData?.final?.code) {
        setIsTracing(true);
        try {
          const traceRes = await api.post('/career/visualizer/trace', {
            code: analysisData.final.code,
            language: language,
          });
          setExecutionTrace(traceRes.data);
        } catch (e) {
          console.error('Failed to parse trace:', e);
          setExecutionTrace({ steps: [], finalOutput: 'Error tracing execution' });
        } finally {
          setIsTracing(false);
        }
      }
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || 'Failed to analyze problem.');
    } finally {
      setLoading(false);
    }
  };

  const handleTraceExecution = async (manualCode) => {
    const codeToTrace = manualCode || data?.final?.code;
    if (!codeToTrace || isTracing) return;
    setIsTracing(true);
    setExecutionTrace({ steps: [], generating: true });
    try {
      const res = await api.post('/career/visualizer/trace', {
        code: codeToTrace,
        language: language,
      });
      setExecutionTrace(res.data);
    } catch (e) {
      console.error('Failed to parse trace:', e);
      setExecutionTrace({ steps: [], finalOutput: 'Error tracing execution' });
    } finally {
      setIsTracing(false);
    }
  };

  const handleLanguageChange = async (newLang) => {
    if (newLang === language) return;
    setLanguage(newLang);
    const el = document.getElementById('tracer-code-input');
    const currentCode = el ? el.value : data?.final?.code;
    if (currentCode && data?.final) {
      try {
        const res = await api.post('/career/visualizer/translate', { code: currentCode, targetLanguage: newLang });
        if (res.data?.code) {
          if (el) el.value = res.data.code;
          setData(prev => prev ? { ...prev, final: { ...prev.final, code: res.data.code, language: newLang } } : prev);
        }
      } catch (e) {
        console.warn('Translation failed:', e);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="career-kicker">Algorithm Visualizer</div>
          <h1 className="font-display font-extrabold text-3xl mt-1 text-[var(--career-text)]">AI-powered interactive teaching</h1>
          <p className="text-sm text-[var(--career-muted)] mt-2 max-w-2xl">
            Paste a LeetCode URL or type a problem name. You’ll get pattern detection + an accurate step walkthrough + final solution.
          </p>
        </div>
        <div className="career-card p-4 flex items-center gap-3 flex-wrap">
          <Sparkles className="text-[var(--career-primary)]" size={24} />
          <input
            type="text"
            placeholder="Paste a LeetCode URL (e.g. /problems/two-sum) or type a topic..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') analyze();
            }}
            className="flex-1 bg-transparent border-none text-[var(--career-text)] outline-none placeholder:text-[var(--career-muted)] text-lg"
            disabled={loading}
          />
          <div className="h-8 w-px bg-[var(--career-border)] hidden sm:block"></div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={loading}
            className="bg-transparent text-[var(--career-text)] text-sm font-semibold outline-none cursor-pointer border-none px-2 appearance-none uppercase"
          >
            <option value="python">Python</option>
            <option value="c++">C++</option>
            <option value="java">Java</option>
          </select>
          <button type="button" onClick={analyze} className="career-btn" disabled={loading || !query.trim()}>
            <Sparkles size={16} /> {loading ? 'Analyzing…' : 'Analyze'}
          </button>
          <button
            type="button"
            onClick={() => {
              setIdx(0);
              setPlaying(false);
              if (window?.speechSynthesis) window.speechSynthesis.cancel();
            }}
            className="career-btn opacity-80 hover:opacity-100"
            disabled={!steps.length}
          >
            <RefreshCw size={16} /> Reset
          </button>
        </div>
      </div>
      {recentQueries.length ? (
        <div className="career-card p-4">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)]">Recent inputs</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {recentQueries.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setQuery(r)}
                className="career-chip hover:opacity-100 opacity-85"
                title={r}
              >
                {r.length > 62 ? `${r.slice(0, 62)}...` : r}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {err ? (
        <div className="career-card border border-red-400 bg-red-50 text-[var(--career-text)]">
          <div className="font-semibold text-red-700">Analyzer error</div>
          <p className="text-sm text-red-600 mt-2">{err}</p>
          <button type="button" onClick={analyze} className="career-btn mt-3">Retry</button>
        </div>
      ) : null}

      {data?.pattern ? (
        <div className="career-card">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="career-kicker">Pattern identified</div>
              <div className="font-display font-extrabold text-2xl mt-1 text-[var(--career-text)]">{data.pattern.name}</div>
              <div className="text-sm text-[var(--career-muted)] mt-2">{data.pattern.ruleOfThumb}</div>
            </div>
            <div className="career-chip">Steps: {steps.length || 0}</div>
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4">
              <div className="font-semibold text-[var(--career-text)]">Approach blueprint</div>
              <ul className="mt-2 text-sm text-[var(--career-muted)] space-y-2">
                {(data.pattern.approach || []).slice(0, 8).map((x, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="career-chip !px-2 !py-0.5 !text-[10px]">{i + 1}</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4">
              <div className="font-semibold text-[var(--career-text)]">How to recognize it next time</div>
              <ul className="mt-2 text-sm text-[var(--career-muted)] space-y-1">
                {(data.pattern.recognitionHints || []).slice(0, 6).map((x, i) => <li key={i}>- {x}</li>)}
              </ul>
            </div>
          </div>
          {Array.isArray(data.pattern.whenToUse) && data.pattern.whenToUse.length ? (
            <div className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4 mt-4">
              <div className="font-semibold text-[var(--career-text)]">When this approach is correct</div>
              <ul className="mt-2 text-sm text-[var(--career-muted)] space-y-1">
                {data.pattern.whenToUse.slice(0, 6).map((x, i) => <li key={i}>- {x}</li>)}
              </ul>
            </div>
          ) : typeof data.pattern.whenToUse === 'string' && data.pattern.whenToUse.trim() ? (
            <div className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4 mt-4">
              <div className="font-semibold text-[var(--career-text)]">When this approach is correct</div>
              <ul className="mt-2 text-sm text-[var(--career-muted)] space-y-1">
                <li>- {data.pattern.whenToUse}</li>
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {data?.problem ? (
        <div className="career-card">
          <div className="font-semibold text-[var(--career-text)]">{data.problem.title}</div>
          <div className="text-sm text-[var(--career-muted)] mt-2 whitespace-pre-wrap">{data.problem.description}</div>
          {data.problem.examples?.length ? (
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {data.problem.examples.slice(0, 2).map((ex, i) => (
                <div key={i} className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4">
                  <div className="font-semibold text-[var(--career-text)]">Example {i + 1}</div>
                  <div className="mt-2 text-sm text-[var(--career-muted)] whitespace-pre-wrap">
                    <div><span className="text-[var(--career-text)] font-semibold">Input:</span> {ex.input}</div>
                    <div><span className="text-[var(--career-text)] font-semibold">Output:</span> {ex.output}</div>
                    {ex.explanation ? <div className="mt-2"><span className="text-[var(--career-text)] font-semibold">Why:</span> {ex.explanation}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {(firstExample || data?.final?.complexity) ? (
        <div className="career-card">
          <div className="career-kicker">Start to end journey</div>
          <div className="font-display font-extrabold text-xl mt-1 text-[var(--career-text)]">Input → Process → Output map</div>
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4">
              <div className="font-semibold text-[var(--career-text)]">Start (Input)</div>
              <div className="text-sm text-[var(--career-muted)] mt-2 whitespace-pre-wrap">
                {firstExample?.input || 'Input will appear here from example #1.'}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4">
              <div className="font-semibold text-[var(--career-text)]">Core process</div>
              <div className="text-sm text-[var(--career-muted)] mt-2">
                {data?.pattern?.ruleOfThumb || 'Pattern explanation unavailable.'}
              </div>
              {data?.final?.complexity ? (
                <div className="mt-3 text-xs text-[var(--career-muted)]">
                  Time: {data.final.complexity.time || 'N/A'} · Space: {data.final.complexity.space || 'N/A'}
                </div>
              ) : null}
            </div>
            <div className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4">
              <div className="font-semibold text-[var(--career-text)]">End (Expected output)</div>
              <div className="text-sm text-[var(--career-muted)] mt-2 whitespace-pre-wrap">
                {firstExample?.output || 'Output will appear here from example #1.'}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {data?.pattern && steps.length === 0 ? (
        <div className="career-card border border-orange-500/30 bg-orange-500/5 p-6 text-center">
          <Activity size={32} className="text-orange-400 mx-auto mb-3" />
          <h3 className="font-semibold text-[var(--career-text)]">Visualization Steps Missing</h3>
          <p className="text-sm text-[var(--career-muted)] mt-1 max-w-lg mx-auto">
            The AI model successfully analyzed the problem pattern but could not generate the granular step-by-step 3D visualization. You can still use the <strong>Trace Code Execution</strong> feature below to write your own Python code and visualize it line-by-line!
          </p>
        </div>
      ) : null}

      {steps.length ? (
        <div className="career-card">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="text-sm text-[var(--career-muted)]">Step {idx + 1}/{steps.length}</div>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => setIdx((i) => Math.max(0, i - 1))} className="career-btn" disabled={idx <= 0}>
                <StepBack size={16} /> Back
              </button>
              <button type="button" onClick={() => setPlaying((p) => !p)} className="career-btn">
                {playing ? <Pause size={16} /> : <Play size={16} />} {playing ? 'Pause' : 'Play'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIdx(0);
                  setPlaying(true);
                }}
                className="career-btn opacity-90 hover:opacity-100"
              >
                <Play size={16} /> Run full journey
              </button>
              <button type="button" onClick={() => setIdx((i) => Math.min(maxIdx, i + 1))} className="career-btn" disabled={idx >= maxIdx}>
                <StepForward size={16} /> Next
              </button>
              <button type="button" onClick={() => setMuted((m) => !m)} className="career-btn opacity-90 hover:opacity-100">
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />} {muted ? 'Muted' : 'Voice'}
              </button>
              <div className="flex items-center gap-2 ml-2">
                <span className="text-xs text-[var(--career-muted)] font-extrabold uppercase tracking-widest">Speed</span>
                <select className="career-input !w-[110px]" value={speedMs} onChange={(e) => setSpeedMs(Number(e.target.value))}>
                  {SPEEDS.map((s) => (
                    <option key={s.label} value={s.ms}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <input
              type="range"
              min={0}
              max={maxIdx}
              value={idx}
              onChange={(e) => setIdx(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
              aria-label="Step scrubber"
            />
          </div>
          <div className="mt-4 rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4">
            <div className="font-semibold text-[var(--career-text)]">Execution checkpoints</div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {checkpoints.map((cp) => (
                <button
                  key={`cp-${cp.stepNo}`}
                  type="button"
                  onClick={() => {
                    setIdx(Math.max(0, cp.stepNo - 1));
                    setPlaying(false);
                  }}
                  className="text-left rounded-xl border border-[var(--career-border)] bg-black/5 hover:bg-black/10 transition-colors p-3"
                >
                  <div className="career-kicker">Step {cp.stepNo}</div>
                  <div className="font-semibold mt-1 text-[var(--career-text)]">{cp.label || `Step ${cp.stepNo}`}</div>
                  <div className="text-xs text-[var(--career-muted)] mt-1 line-clamp-2">{cp.stepText || 'No detail available.'}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4">
              <div className="font-semibold text-[var(--career-text)]">{step?.label || 'Step'}</div>
              <div className="text-sm text-[var(--career-muted)] mt-1">{step?.stepText || ''}</div>
              <div className="mt-4 space-y-4">
                {step?.state?.array?.length ? (
                  <ArrayViz array={step.state.array} pointers={step.state.pointers || []} window={step.state.window} />
                ) : (
                  <div className="text-sm text-[var(--career-muted)]">No array visualization for this step.</div>
                )}
                {graphData?.nodes?.length ? <GraphViz graph={graphData} /> : null}
                {step?.state?.tree?.nodes?.length ? <TreeViz tree={step.state.tree} /> : null}
              </div>
            </div>

            <div className="space-y-4 flex flex-col">
              <StackViz stack={step?.state?.stack || []} />
              <QueueViz queue={step?.state?.queue || []} />
              <div className="rounded-xl border border-[rgba(6,182,212,0.25)] bg-[rgba(6,182,212,0.06)] p-4 min-h-[160px]">
                <div className="career-kicker">Teacher voice (text)</div>
                <div className="text-sm text-[var(--career-text)] mt-2 whitespace-pre-wrap">
                  {(step?.voiceText || voiceCache[idx]) ? (step?.voiceText || voiceCache[idx]) : <span className="text-[var(--career-muted)] italic">No teacher context for this step.</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {data?.final ? (
        <div className="career-card">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--career-border)] mb-4">
            <div className="font-semibold text-lg flex items-center gap-2 text-[var(--career-text)]">
              <Sparkles size={18} className="text-cyan-400" /> Optimal solution
            </div>
            <div className="flex space-x-2 items-center">
              {isTracing ? (
                 <button
                   type="button"
                   onClick={() => setIsTracing(false)}
                   className="career-btn !bg-black/10 hover:!bg-black/15 !text-[var(--career-text)]"
                 >
                   Exit Tracer
                 </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsTracing(true)}
                  className="career-btn !bg-cyan-500/20 hover:!bg-cyan-500/30 !text-cyan-600 !border-cyan-500/30"
                >
                  <Play size={16} /> Trace Code Execution
                </button>
              )}
            </div>
          </div>
          
          {isTracing ? (
             <div className="mt-3 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                         <span className="font-semibold text-[var(--career-text)]">Code Input</span>
                         <select
                           value={language}
                           onChange={(e) => handleLanguageChange(e.target.value)}
                           className="text-[10px] tracking-wider font-bold bg-amber-500/20 text-orange-600 px-2 py-0.5 rounded uppercase border-none outline-none cursor-pointer"
                         >
                           <option value="python">Python</option>
                           <option value="c++">C++</option>
                           <option value="java">Java</option>
                         </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const sample = `def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n\ndef fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n - 1) + fibonacci(n - 2)\n\nresult = factorial(5)\nfib_result = fibonacci(6)\nprint(f"Factorial: {result}, Fibonacci: {fib_result}")`;
                            // Quick hack to set the text area
                            const el = document.getElementById('tracer-code-input');
                            if (el) el.value = sample;
                          }}
                          className="text-xs text-[var(--career-muted)] hover:text-[var(--career-text)] transition-colors px-2 py-1"
                        >
                          Load Sample
                        </button>
                        <button
                           onClick={async () => {
                              const el = document.getElementById('tracer-code-input');
                              if (!el || !el.value.trim()) return;
                              
                              // Create loading state directly using existing trace logic
                              try {
                                  setExecutionTrace({ steps: [], generating: true }); // temporary flag we can check
                                  const res = await api.post('/career/visualizer/trace', {
                                      code: el.value,
                                      language: language,
                                  });
                                  setExecutionTrace(res.data);
                                  // remove generating flag
                              } catch (e) {
                                  setExecutionTrace({ steps: [], finalOutput: 'Error: ' + String(e) });
                              }
                           }}
                           className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded font-medium flex items-center gap-1 transition-colors"
                        >
                           <Activity size={12} /> Visualize
                        </button>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-4 h-[600px]">
                    <div className="w-full lg:w-5/12 h-full rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] overflow-hidden relative">
                         <textarea
                            id="tracer-code-input"
                            defaultValue={data.final.code || ''}
                            spellCheck="false"
                            className="w-full h-full p-4 bg-transparent text-sm text-[var(--career-text)] font-mono resize-none focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                            placeholder={`Write ${language === 'python' ? 'Python' : language === 'c++' ? 'C++' : 'Java'} code here to trace...`}
                         />
                    </div>
                    <div className="w-full lg:w-7/12 h-full flex flex-col">
                       {executionTrace?.generating ? (
                           <div className="flex-1 flex items-center justify-center border border-[var(--career-border)] rounded-xl bg-[var(--career-surface)]">
                              <Activity className="animate-spin text-orange-500" size={32} />
                           </div>
                       ) : executionTrace ? (
                           <div className="flex-1 overflow-hidden">
                               <ExecutionAnimator trace={executionTrace} code={document.getElementById('tracer-code-input')?.value || data.final.code} />
                           </div>
                       ) : (
                           <div className="flex-1 flex items-center justify-center border border-[var(--career-border)] rounded-xl bg-[var(--career-surface)] text-[var(--career-muted)] text-sm">
                               Click Visualize to trace execution
                           </div>
                       )}
                    </div>
                </div>
             </div>
          ) : (
            <div className="mt-3 rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4 overflow-x-auto relative group">
              <pre className="text-sm text-[var(--career-text)] whitespace-pre">{data.final.code}</pre>
            </div>
          )}
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4">
              <div className="font-semibold text-[var(--career-text)]">Complexity</div>
              <div className="text-sm text-[var(--career-muted)] mt-2">
                <div><span className="font-semibold text-[var(--career-text)]">Time:</span> {data.final.complexity?.time}</div>
                <div><span className="font-semibold text-[var(--career-text)]">Space:</span> {data.final.complexity?.space}</div>
                {data.final.complexity?.explain ? <div className="mt-2">{data.final.complexity.explain}</div> : null}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4">
              <div className="font-semibold text-[var(--career-text)]">Similar problems to practice now</div>
              <ul className="mt-2 text-sm text-[var(--career-muted)] space-y-1">
                {(data.final.similar || []).slice(0, 6).map((p, i) => <li key={i}>- {p.title} ({p.pattern})</li>)}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

