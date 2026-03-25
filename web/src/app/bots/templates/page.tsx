'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TemplateParam {
  key: string;
  label: string;
  type: 'number' | 'select';
  default: number | string;
  min?: number;
  max?: number;
  options?: { label: string; value: string | number }[];
  description: string;
}

interface BotTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  params: TemplateParam[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const difficultyConfig: Record<string, { bg: string; text: string; label: string }> = {
  BEGINNER:     { bg: 'rgba(16,185,129,0.15)', text: 'var(--accent-emerald, #10b981)', label: 'Beginner' },
  INTERMEDIATE: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b',                       label: 'Intermediate' },
  ADVANCED:     { bg: 'rgba(139,92,246,0.15)',  text: '#8b5cf6',                       label: 'Advanced' },
};

const categoryIcons: Record<string, string> = {
  'Trend Following': '\u2197\ufe0f',
  'Mean Reversion':  '\u21c6',
  'Market Making':   '\u2593',
  'Scalping':        '\u26a1',
  'Breakout':        '\u{1f680}',
  'Value':           '\u{1f4c9}',
};

function buildPreviewText(template: BotTemplate, paramValues: Record<string, number | string>): string {
  switch (template.id) {
    case 'momentum':
      return `Your bot will follow price trends over ${paramValues.lookback} ticks, triggering trades when price changes by ${paramValues.threshold}%, risking ${paramValues.positionSize}% of capital per trade.`;
    case 'mean-reversion':
      return `Your bot will calculate a ${paramValues.window}-tick moving average and trade when price deviates by ${paramValues.zThreshold} standard deviations, using ${paramValues.positionSize}% position size.`;
    case 'grid-trader':
      return `Your bot will place grid orders every ${paramValues.gridSpacing}% with ${paramValues.gridLevels} levels, allocating ${paramValues.positionSize}% per level.`;
    case 'scalper':
      return `Your bot will scalp small moves, taking profit at ${paramValues.takeProfit}% and cutting losses at ${paramValues.stopLoss}%, with ${paramValues.positionSize}% position sizing.`;
    case 'breakout':
      return `Your bot will watch ${paramValues.consolidationPeriod} ticks for consolidation, entering on ${paramValues.breakoutThreshold}% breakouts with ${paramValues.positionSize}% of capital.`;
    case 'dip-buyer':
      return `Your bot will buy when price drops ${paramValues.dipThreshold}% from recent highs, targeting a ${paramValues.recoveryTarget}% recovery, risking ${paramValues.positionSize}% per trade.`;
    default:
      return `Your bot will execute the ${template.name} strategy with your custom parameters.`;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<BotTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BotTemplate | null>(null);
  const [botName, setBotName] = useState('');
  const [paramValues, setParamValues] = useState<Record<string, number | string>>({});
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Fetch templates */
  const fetchTemplates = useCallback(async () => {
    try {
      const data = await api.request<BotTemplate[]>('/api/templates');
      setTemplates(data);
    } catch {
      /* empty */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  /* When a template is selected, seed param defaults */
  const handleSelect = useCallback((tpl: BotTemplate) => {
    setSelected(tpl);
    setError(null);
    const defaults: Record<string, number | string> = {};
    tpl.params.forEach((p) => {
      defaults[p.key] = p.default;
    });
    setParamValues(defaults);
    setBotName(`${tpl.name} Bot`);
  }, []);

  /* Update a single param */
  const setParam = useCallback((key: string, value: number | string) => {
    setParamValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  /* Preview text */
  const previewText = useMemo(() => {
    if (!selected) return '';
    return buildPreviewText(selected, paramValues);
  }, [selected, paramValues]);

  /* Deploy */
  const handleDeploy = async () => {
    if (!selected || !botName.trim()) return;
    setDeploying(true);
    setError(null);
    try {
      await api.request('/api/templates/deploy', {
        method: 'POST',
        body: JSON.stringify({
          name: botName.trim(),
          templateId: selected.id,
          params: paramValues,
        }),
      });
      router.push('/bots');
    } catch (err: any) {
      setError(err?.message || 'Deploy failed');
    }
    setDeploying(false);
  };

  /* ----- Render ---------------------------------------------------- */

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20">

      {/* ============ HERO ============ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center pt-4"
      >
        <h1
          className="text-4xl md:text-5xl font-bold font-[var(--font-display)] text-[var(--text-primary)] leading-tight"
        >
          Build a Bot{' '}
          <span className="bg-gradient-to-r from-[var(--accent-indigo)] to-[var(--accent-purple,#a855f7)] bg-clip-text text-transparent">
            No Code Required
          </span>
        </h1>
        <p className="mt-3 text-lg text-[var(--text-secondary)] max-w-xl mx-auto">
          Pick a strategy, tune the parameters, deploy in seconds
        </p>
      </motion.div>

      {/* ============ TEMPLATE GRID ============ */}
      {loading ? (
        <div className="text-center py-20 text-[var(--text-tertiary)]">Loading templates...</div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {templates.map((tpl, i) => {
            const diff = difficultyConfig[tpl.difficulty] || difficultyConfig.BEGINNER;
            const isSelected = selected?.id === tpl.id;
            return (
              <motion.div
                key={tpl.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 * i, duration: 0.35 }}
              >
                <Card
                  className={`relative cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'border-[var(--accent-indigo)] shadow-[0_0_24px_rgba(99,102,241,0.25)]'
                      : 'hover:border-[var(--border-hover)]'
                  }`}
                  onClick={() => handleSelect(tpl)}
                >
                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-[var(--accent-indigo)] shadow-[0_0_8px_var(--accent-indigo)]" />
                  )}

                  {/* Category + Difficulty badges */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span
                      className="text-xs font-medium font-[var(--font-mono)] px-2.5 py-1 rounded-full bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-default)]"
                    >
                      {categoryIcons[tpl.category] || ''} {tpl.category}
                    </span>
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: diff.bg, color: diff.text }}
                    >
                      {diff.label}
                    </span>
                  </div>

                  {/* Name */}
                  <CardTitle className="text-lg mb-2">{tpl.name}</CardTitle>

                  {/* Description */}
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                    {tpl.description}
                  </p>

                  {/* Params preview */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {tpl.params.map((p) => (
                      <span
                        key={p.key}
                        className="text-[10px] font-[var(--font-mono)] px-2 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-tertiary)] border border-[var(--border-default)]"
                      >
                        {p.label}
                      </span>
                    ))}
                  </div>

                  {/* Select button */}
                  <Button
                    variant={isSelected ? 'primary' : 'secondary'}
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(tpl);
                    }}
                  >
                    {isSelected ? 'Selected' : 'Select'}
                  </Button>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* ============ CONFIGURATION PANEL ============ */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key="config-panel"
            initial={{ opacity: 0, y: 30, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 20, height: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <Card hover={false} className="border-[var(--accent-indigo)] border-opacity-50 overflow-hidden">
              {/* Section header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-purple,#a855f7)] flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold font-[var(--font-display)] text-[var(--text-primary)]">
                    Configure {selected.name}
                  </h2>
                  <p className="text-sm text-[var(--text-tertiary)]">
                    Tune the parameters to match your trading style
                  </p>
                </div>
              </div>

              {/* Bot name */}
              <div className="mb-6">
                <Input
                  label="Bot Name"
                  placeholder="e.g. My Alpha Bot"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                />
              </div>

              {/* Parameter sliders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {selected.params.map((param) => {
                  const val = paramValues[param.key] ?? param.default;
                  if (param.type === 'select' && param.options) {
                    return (
                      <div key={param.key} className="space-y-2">
                        <label className="block text-sm font-medium text-[var(--text-secondary)]">
                          {param.label}
                        </label>
                        <select
                          className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-indigo)]"
                          value={val}
                          onChange={(e) => setParam(param.key, e.target.value)}
                        >
                          {param.options.map((opt) => (
                            <option key={String(opt.value)} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-[var(--text-tertiary)]">{param.description}</p>
                      </div>
                    );
                  }

                  /* Number param — slider + input */
                  const numVal = typeof val === 'number' ? val : Number(val);
                  const step = param.min !== undefined && param.max !== undefined
                    ? (param.max - param.min) <= 5 ? 0.01 : 1
                    : 1;

                  return (
                    <div key={param.key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-[var(--text-secondary)]">
                          {param.label}
                        </label>
                        <span className="text-sm font-bold font-[var(--font-mono)] text-[var(--accent-indigo)]">
                          {numVal}
                        </span>
                      </div>

                      {/* Slider track */}
                      <div className="relative">
                        <input
                          type="range"
                          min={param.min ?? 0}
                          max={param.max ?? 100}
                          step={step}
                          value={numVal}
                          onChange={(e) => setParam(param.key, parseFloat(e.target.value))}
                          className="w-full h-2 rounded-full appearance-none cursor-pointer
                            bg-[var(--bg-primary)]
                            [&::-webkit-slider-thumb]:appearance-none
                            [&::-webkit-slider-thumb]:w-5
                            [&::-webkit-slider-thumb]:h-5
                            [&::-webkit-slider-thumb]:rounded-full
                            [&::-webkit-slider-thumb]:bg-[var(--accent-indigo)]
                            [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(99,102,241,0.5)]
                            [&::-webkit-slider-thumb]:cursor-pointer
                            [&::-webkit-slider-thumb]:transition-shadow
                            [&::-webkit-slider-thumb]:hover:shadow-[0_0_16px_rgba(99,102,241,0.7)]
                            [&::-moz-range-thumb]:w-5
                            [&::-moz-range-thumb]:h-5
                            [&::-moz-range-thumb]:rounded-full
                            [&::-moz-range-thumb]:bg-[var(--accent-indigo)]
                            [&::-moz-range-thumb]:border-0
                            [&::-moz-range-thumb]:cursor-pointer"
                        />
                      </div>

                      {/* Min / Max labels */}
                      <div className="flex justify-between">
                        <span className="text-[10px] font-[var(--font-mono)] text-[var(--text-tertiary)]">
                          {param.min}
                        </span>
                        <span className="text-[10px] font-[var(--font-mono)] text-[var(--text-tertiary)]">
                          {param.max}
                        </span>
                      </div>

                      <p className="text-xs text-[var(--text-tertiary)]">{param.description}</p>
                    </div>
                  );
                })}
              </div>

              {/* Live preview */}
              <motion.div
                key={previewText}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] p-4 mb-8"
              >
                <p className="text-xs uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5 font-[var(--font-mono)]">
                  Live Preview
                </p>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {previewText}
                </p>
              </motion.div>

              {/* Error */}
              {error && (
                <div className="rounded-xl bg-[rgba(239,68,68,0.1)] border border-[var(--accent-red)] px-4 py-3 mb-4">
                  <p className="text-sm text-[var(--accent-red)]">{error}</p>
                </div>
              )}

              {/* Deploy button */}
              <Button
                size="lg"
                className="w-full text-base"
                loading={deploying}
                onClick={handleDeploy}
                disabled={!botName.trim()}
              >
                Deploy Bot
              </Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
