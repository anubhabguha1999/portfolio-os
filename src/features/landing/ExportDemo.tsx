import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Download, GripVertical, Pause, Play } from 'lucide-react';
import { cn } from '@/utils/cn';

/**
 * Builder → Portfolio → HTML / PDF / DOCX / ZIP.
 * A looping, self-contained product demo. With reduced motion it renders the
 * finished state as a still image.
 */

const NAME = 'Maya Lindqvist';
const PHASE_MS = [2100, 1500, 1100, 3000, 700] as const;
type Phase = 0 | 1 | 2 | 3 | 4;
const FINAL: Phase = 3;

const SECTIONS = ['Hero', 'About', 'Projects', 'Experience', 'Contact'];
const SWATCHES = ['#8b7cff', '#3ecf8e', '#f5b455', '#ff7a8a'];

const OUTPUTS = [
  { ext: 'HTML', file: 'index.html', note: 'Single file', color: '#f97316' },
  { ext: 'PDF', file: 'portfolio.pdf', note: 'Print-ready', color: '#ef4444' },
  { ext: 'DOCX', file: 'resume.docx', note: 'Editable', color: '#3b82f6' },
  { ext: 'ZIP', file: 'website.zip', note: 'Deploy-ready', color: '#a78bfa' },
] as const;

const ease = [0.16, 1, 0.3, 1] as const;

function usePhase(still: boolean, paused: boolean): Phase {
  const [phase, setPhase] = useState<Phase>(still ? FINAL : 0);
  useEffect(() => {
    if (still) {
      setPhase(FINAL);
      return;
    }
    if (paused) return;
    const id = window.setTimeout(() => setPhase((p) => ((p + 1) % PHASE_MS.length) as Phase), PHASE_MS[phase]);
    return () => window.clearTimeout(id);
  }, [phase, still, paused]);
  return phase;
}

function useTyped(active: boolean, text: string, full: boolean): string {
  const [n, setN] = useState(full ? text.length : 0);
  useEffect(() => {
    if (full) {
      setN(text.length);
      return;
    }
    if (!active) {
      setN(0);
      return;
    }
    setN(0);
    const id = window.setInterval(() => setN((v) => (v >= text.length ? v : v + 1)), 95);
    return () => window.clearInterval(id);
  }, [active, text, full]);
  return text.slice(0, n);
}

export function ExportDemo() {
  const reduced = useReducedMotion() ?? false;
  const [paused, setPaused] = useState(false);
  const phase = usePhase(reduced, paused);
  const typing = phase === 0;
  const typed = useTyped(typing, NAME, reduced || (phase > 0 && phase < 4));
  const built = phase >= 1 && phase <= 3;
  const exporting = phase >= 2 && phase <= 3;
  const done = phase === 3;

  return (
    <figure className="relative">
      <div
        role="img"
        aria-label="Demonstration: a name typed into the builder flows into a live portfolio, which is then exported as HTML, PDF, Word and a deployable ZIP."
        className="relative grid items-center gap-4 lg:grid-cols-[minmax(0,1.1fr)_40px_minmax(0,1fr)_40px_minmax(0,0.72fr)] lg:gap-0"
      >
        {/* ------------------------------ Builder ------------------------------ */}
        <div aria-hidden="true" className="overflow-hidden rounded-2xl border border-line bg-panel shadow-float">
          <WindowBar title="Builder" subtitle="Maya — Portfolio" />
          <div className="grid grid-cols-[112px_1fr] sm:grid-cols-[128px_1fr]">
            <ul className="space-y-0.5 border-r border-line p-2">
              {SECTIONS.map((s, i) => (
                <li
                  key={s}
                  className={cn('flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-[11px]', i === 0 ? 'bg-accent-soft text-fg' : 'text-fg-muted')}
                >
                  <GripVertical className="size-3 shrink-0 text-fg-subtle" />
                  <span className="truncate">{s}</span>
                  <span className={cn('ml-auto size-1.5 rounded-full', i === 0 ? 'bg-accent' : 'bg-ok/70')} />
                </li>
              ))}
            </ul>
            <div className="space-y-3 p-3">
              <MiniField label="Name">
                <span className="text-fg">{typed}</span>
                {typing && <span className="ml-px inline-block h-3 w-px translate-y-0.5 animate-pulse bg-accent" />}
              </MiniField>
              <MiniField label="Headline">
                <span className={cn('transition-colors duration-500', phase === 0 ? 'text-fg-subtle' : 'text-fg')}>Product engineer, Stockholm</span>
              </MiniField>
              <div>
                <p className="mb-1.5 text-[9.5px] font-medium uppercase tracking-[0.12em] text-fg-subtle">Theme</p>
                <div className="flex gap-1.5">
                  {SWATCHES.map((c, i) => (
                    <span key={c} className={cn('size-4 rounded-full ring-offset-2 ring-offset-panel', i === 0 && 'ring-1 ring-fg/60')} style={{ background: c }} />
                  ))}
                </div>
              </div>
              <motion.div
                className="flex h-7 items-center justify-center gap-1.5 rounded-md bg-accent text-[11px] font-semibold text-accent-fg"
                animate={phase === 2 && !reduced ? { scale: [1, 0.94, 1] } : { scale: 1 }}
                transition={{ duration: 0.35, ease }}
              >
                <Download className="size-3" />
                Export
              </motion.div>
            </div>
          </div>
        </div>

        <Connector active={built && !reduced} delay={0} />

        {/* ----------------------------- Portfolio ----------------------------- */}
        <div aria-hidden="true" className="relative overflow-hidden rounded-2xl border border-line bg-[#fbfaf7] text-[#16161d] shadow-float">
          <div className="flex items-center gap-1.5 border-b border-black/[.07] px-3 py-2">
            <span className="size-2 rounded-full bg-black/10" />
            <span className="size-2 rounded-full bg-black/10" />
            <span className="size-2 rounded-full bg-black/10" />
            <span className="ml-2 flex-1 truncate rounded bg-black/[.05] px-2 py-0.5 text-center font-mono text-[9px] text-black/[.62]">maya-lindqvist.dev</span>
          </div>
          <div className="p-4">
            <div className="mb-4 flex items-center justify-between text-[9px] text-black/[.62]">
              <span className="font-semibold text-black/70">ML</span>
              <span className="flex gap-2">
                <span>Work</span>
                <span>About</span>
                <span>Contact</span>
              </span>
            </div>
            <div className="min-h-[46px]">
              <p className="text-[9px] uppercase tracking-[0.14em] text-[#6a58f5]">Product engineer</p>
              <p className="mt-1 min-h-[22px] font-display text-[19px] italic leading-tight tracking-tight">{typed || ' '}</p>
            </div>
            <div className="mt-3 space-y-1">
              <Bar w="92%" on={built} d={0.05} reduced={reduced} />
              <Bar w="70%" on={built} d={0.1} reduced={reduced} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[0, 1].map((i) => (
                <motion.div
                  key={i}
                  className="aspect-[4/3] rounded-md"
                  style={{ background: i === 0 ? 'linear-gradient(135deg,#8b7cff,#3ecf8e)' : 'linear-gradient(135deg,#f5b455,#ff7a8a)' }}
                  initial={false}
                  animate={built ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0.12, y: 6, scale: 0.97 }}
                  transition={{ duration: reduced ? 0 : 0.6, delay: reduced ? 0 : 0.18 + i * 0.12, ease }}
                />
              ))}
            </div>
          </div>
          <AnimatePresence>
            {exporting && !reduced && (
              <motion.div
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-[#8b7cff]/15 to-transparent"
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: 'easeInOut' }}
              />
            )}
          </AnimatePresence>
        </div>

        <Connector active={exporting && !reduced} delay={0.1} />

        {/* ------------------------------ Outputs ------------------------------ */}
        <ul aria-hidden="true" className="grid gap-2 min-[420px]:grid-cols-2 lg:grid-cols-1">
          {OUTPUTS.map((o, i) => (
            <motion.li
              key={o.ext}
              className="flex items-center gap-2.5 rounded-xl border border-line bg-panel/90 p-2 pr-3 shadow-float backdrop-blur"
              initial={false}
              animate={exporting ? { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 } : { opacity: 0, x: -18, y: (1.5 - i) * 10, scale: 0.94, rotate: (i - 1.5) * 2 }}
              transition={{ duration: reduced ? 0 : 0.55, delay: reduced || !exporting ? 0 : 0.12 * i, ease }}
            >
              <span className="grid h-9 w-8 shrink-0 place-items-end rounded-[5px] pb-1 font-mono text-[8px] font-bold text-white" style={{ background: o.color }}>
                <span className="w-full text-center">{o.ext}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11.5px] font-medium">{o.file}</span>
                <span className="block text-[10px] text-fg-subtle">{o.note}</span>
              </span>
              <motion.span
                className="grid size-4 shrink-0 place-items-center rounded-full bg-ok text-bg"
                initial={false}
                animate={done ? { scale: 1, opacity: 1 } : { scale: 0.4, opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.3, delay: reduced ? 0 : 0.08 * i }}
              >
                <Check className="size-2.5" strokeWidth={3.5} />
              </motion.span>
            </motion.li>
          ))}
        </ul>
      </div>
      <figcaption className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12px] text-fg-subtle">
        <span>One data model. Four finished formats. Zero uploads.</span>
        {!reduced && (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-fg-muted hover:bg-hover hover:text-fg"
            aria-pressed={paused}
          >
            {paused ? <Play className="size-3" aria-hidden="true" /> : <Pause className="size-3" aria-hidden="true" />}
            {paused ? 'Play animation' : 'Pause animation'}
          </button>
        )}
      </figcaption>
    </figure>
  );
}

function WindowBar({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-line bg-elevated/60 px-3 py-2">
      <span className="flex gap-1">
        <span className="size-2 rounded-full bg-[#ff5f57]/80" />
        <span className="size-2 rounded-full bg-[#febc2e]/80" />
        <span className="size-2 rounded-full bg-[#28c840]/80" />
      </span>
      <span className="ml-1 text-[11px] font-medium">{title}</span>
      <span className="truncate text-[11px] text-fg-subtle">/ {subtitle}</span>
    </div>
  );
}

function MiniField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[9.5px] font-medium uppercase tracking-[0.12em] text-fg-subtle">{label}</p>
      <div className="flex h-7 items-center overflow-hidden rounded-md border border-line bg-bg px-2 text-[11.5px] whitespace-nowrap">{children}</div>
    </div>
  );
}

function Bar({ w, on, d, reduced }: { w: string; on: boolean; d: number; reduced: boolean }) {
  return (
    <motion.div
      className="h-1.5 origin-left rounded-full bg-black/10"
      style={{ width: w }}
      initial={false}
      animate={{ scaleX: on ? 1 : 0.35, opacity: on ? 1 : 0.5 }}
      transition={{ duration: reduced ? 0 : 0.5, delay: reduced ? 0 : d, ease }}
    />
  );
}

/** A connector with a travelling pulse — horizontal on desktop, hidden when stacked. */
function Connector({ active, delay }: { active: boolean; delay: number }) {
  return (
    <div aria-hidden="true" className="relative hidden h-px lg:block">
      <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,var(--app-line-strong)_0_4px,transparent_4px_8px)]" />
      <AnimatePresence>
        {active && (
          <motion.span
            className="absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_12px_2px_var(--app-accent)]"
            initial={{ left: '0%', opacity: 0 }}
            animate={{ left: '100%', opacity: [0, 1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, delay, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
