'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export default function Hero() {
  const [query, setQuery] = useState('');
  const prefersReduced = useReducedMotion();

  return (
    <section className="relative">
      <div className="mx-auto max-w-[46rem] px-4 sm:px-6 pt-24 sm:pt-28 text-center group">
        {/* Headline */}
        <motion.div
          initial={prefersReduced ? {} : { opacity: 0, y: 10 }}
          animate={prefersReduced ? {} : { opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="space-y-2 sm:space-y-3"
        >
          <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-foreground/90 transition-opacity group-focus-within:opacity-90">
            Describe your lead.
          </h1>
          <p className="text-4xl sm:text-6xl font-semibold leading-[1.05] tracking-tight text-foreground transition-opacity group-focus-within:opacity-90">
            We open a perfect Sales Navigator search.
          </p>
        </motion.div>

        {/* Value bullets */}
        <p className="mt-3 text-base sm:text-lg text-foreground/80">
          <span className="before:content-['•'] before:mr-2">Roles &amp; seniority auto-parsed</span>
          <span className="mx-3">·</span>
          <span className="before:content-['•'] before:mr-2">Geo &amp; industry IDs handled</span>
          <span className="mx-3">·</span>
          <span className="before:content-['•'] before:mr-2">No guessing—paste straight into SalesNav</span>
        </p>

        {/* Search */}
        <div className="mt-6">
          <div className="relative">
            <label htmlFor="lead-search" className="sr-only">
              Describe your lead
            </label>
            <input
              id="lead-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="How can I help you today?"
              className="w-full h-12 sm:h-14 rounded-2xl border bg-background/80 backdrop-blur px-5 pr-12 text-base sm:text-lg outline-none ring-0 focus:ring-4 focus:ring-primary/20 border-border shadow-sm focus:shadow-md transition"
            />
            <button
              aria-label="Generate search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm bg-secondary text-secondary-foreground hover:bg-secondary/90 transition"
            >
              ↗
            </button>
          </div>
        </div>

        {/* Recent searches */}
        <div className="mt-5 flex flex-wrap justify-center gap-3 text-sm">
          <button className="rounded-full border px-3 py-1.5 bg-muted hover:bg-muted/80 transition">
            B2B SaaS SDRs at startups in San Francisco
          </button>
          <button className="rounded-full border px-3 py-1.5 bg-muted hover:bg-muted/80 transition">
            Sales engineers in NYC cybersecurity
          </button>
        </div>
      </div>
    </section>
  );
}


