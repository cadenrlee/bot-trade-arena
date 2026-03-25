'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const features = [
  { title: 'Build', desc: 'Write trading bots in Python, TypeScript, Go, or any WebSocket language', icon: '>' },
  { title: 'Compete', desc: 'Real-time head-to-head matches using live crypto market data', icon: '+' },
  { title: 'Climb', desc: 'ELO-based ranking system with Bronze to Diamond tiers', icon: '^' },
  { title: 'Earn', desc: 'Streaks, quests, XP, achievements, and season pass rewards', icon: '*' },
];

const tiers = [
  { name: 'Free', price: '$0', period: '', features: ['5 bots', '2 ladder matches/day', 'Sandbox mode', 'Spectating'] },
  { name: 'Competitor', price: '$9.99', period: '/mo', features: ['15 bots', 'Unlimited matches', 'Tournaments', 'Advanced analytics', 'Priority matchmaking'], popular: true },
  { name: 'Pro', price: '$24.99', period: '/mo', features: ['Unlimited bots', 'All game modes', 'Custom durations', 'Season pass included', 'Priority support'] },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-24 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--accent-indigo)]/5 to-transparent" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative max-w-3xl mx-auto"
        >
          <h1 className="text-5xl md:text-6xl font-bold font-[family-name:var(--font-display)] tracking-tight mb-6">
            Build Trading Bots.
            <br />
            <span className="bg-gradient-to-r from-[var(--accent-indigo)] to-[var(--accent-purple)] bg-clip-text text-transparent">
              Compete Head-to-Head.
            </span>
          </h1>
          <p className="text-lg text-[var(--text-secondary)] mb-10 max-w-xl mx-auto">
            Bot Trade Arena is the competitive platform where your algorithms battle in real-time using live crypto market data. Climb the ranks from Bronze to Diamond.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/matches/live">
              <Button size="lg">Watch Live Matches</Button>
            </Link>
            <Link href="/auth/register">
              <Button size="lg" variant="secondary">Create Account</Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="h-full p-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-[var(--accent-indigo)]/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-mono text-[var(--accent-indigo)]">{f.icon}</span>
                </div>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--text-secondary)]">{f.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20 bg-[var(--bg-secondary)]/50">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-bold font-[family-name:var(--font-display)] mb-4">How It Works</h2>
          <p className="text-[var(--text-secondary)]">Three steps to competitive bot trading</p>
        </div>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {['Write your bot in any language using our WebSocket API', 'Queue for a match — our matchmaker finds an opponent at your skill level', 'Trade head-to-head with live Binance data. Best composite score wins.'].map((step, i) => (
            <div key={i} className="text-center">
              <div className="w-10 h-10 rounded-full bg-[var(--accent-indigo)] text-white flex items-center justify-center mx-auto mb-4 font-bold font-[var(--font-mono)]">
                {i + 1}
              </div>
              <p className="text-sm text-[var(--text-secondary)]">{step}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Scoring explainer */}
      <section className="px-6 py-20 max-w-4xl mx-auto text-center">
        <h2 className="text-3xl font-bold font-[family-name:var(--font-display)] mb-4">Not Just Win Rate</h2>
        <p className="text-[var(--text-secondary)] mb-8 max-w-xl mx-auto">
          Our composite scoring rewards real trading skill — P&L, profit factor, Sharpe ratio, risk management, and win rate — with anti-gaming protections.
        </p>
        <div className="grid grid-cols-5 gap-2">
          {[{ label: 'P&L', max: 250 }, { label: 'Profit Factor', max: 250 }, { label: 'Sharpe', max: 250 }, { label: 'Risk Mgmt', max: 150 }, { label: 'Win Rate', max: 100 }].map((c) => (
            <div key={c.label} className="text-center">
              <div className="h-24 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] flex items-end justify-center p-2 mb-2">
                <div
                  className="w-full rounded bg-gradient-to-t from-[var(--accent-indigo)] to-[var(--accent-purple)]"
                  style={{ height: `${(c.max / 250) * 100}%` }}
                />
              </div>
              <p className="text-xs text-[var(--text-tertiary)]">{c.label}</p>
              <p className="text-sm font-[var(--font-mono)] font-bold">{c.max}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-20 bg-[var(--bg-secondary)]/50">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-bold font-[family-name:var(--font-display)] mb-4">Plans</h2>
          <p className="text-[var(--text-secondary)]">Free tier always works. Upgrade for more.</p>
        </div>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={`p-6 text-center ${tier.popular ? 'border-[var(--accent-indigo)] ring-1 ring-[var(--accent-indigo)]' : ''}`}
            >
              {tier.popular && (
                <span className="inline-block text-xs font-bold uppercase tracking-wider text-[var(--accent-indigo)] mb-2">
                  Most Popular
                </span>
              )}
              <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
              <p className="text-3xl font-bold font-[var(--font-mono)] mb-1">{tier.price}</p>
              <p className="text-xs text-[var(--text-tertiary)] mb-6">{tier.period}</p>
              <ul className="space-y-2 text-sm text-[var(--text-secondary)] mb-6 text-left">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-[var(--accent-emerald)]">+</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                variant={tier.popular ? 'primary' : 'secondary'}
                className="w-full"
              >
                {tier.price === '$0' ? 'Get Started' : 'Subscribe'}
              </Button>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 text-center">
        <h2 className="text-3xl font-bold font-[family-name:var(--font-display)] mb-4">Ready to compete?</h2>
        <p className="text-[var(--text-secondary)] mb-8">Watch a live match first. No signup required.</p>
        <Link href="/matches/live">
          <Button size="lg">Watch Live Matches</Button>
        </Link>
      </section>
    </div>
  );
}
