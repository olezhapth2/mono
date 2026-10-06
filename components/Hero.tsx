'use client';

import { useEffect, useState } from 'react';
import InfiniteGallery from '@/components/InfiniteGallery';
import { GALLERY_IMAGES } from '@/lib/galleryImages';
import { FLY_IMAGES } from '@/lib/flyImages';
import { heroCopy } from '@/lib/copy';
import { subscribeActiveCard } from '@/lib/activeCard';

function ArrowIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M2.5 8h10.5M9.2 3.4 13.8 8l-4.6 4.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Hero() {
  const [card, setCard] = useState<number | null>(0);

  useEffect(() => subscribeActiveCard(setCard), []);

  const eyebrow =
    card === null ? heroCopy.h1Alt : (heroCopy.cardEyebrows[card] ?? heroCopy.h1Alt);

  return (
    <section className="relative h-dvh min-h-[640px] w-full overflow-hidden bg-stone">
      <div className="absolute inset-0">
        <InfiniteGallery
          images={GALLERY_IMAGES}
          flyImages={FLY_IMAGES}
          className="h-full w-full"
        />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-radial-[at_50%_74%] from-white/92 via-white/60 to-white/10" />

      <div className="relative flex h-full flex-col items-center justify-end px-6 pb-20 text-center select-text">
        <p
          key={eyebrow}
          className="mb-5 font-mono text-xs tracking-[0.3em] text-olive-deep uppercase opacity-0 drop-shadow-[0_1px_10px_rgba(255,255,255,0.9)] [animation:fade-in_0.45s_forwards]"
        >
          {eyebrow}
        </p>

        <h1 className="max-w-4xl text-6xl leading-[1.03] font-semibold tracking-tight text-ink-deep text-balance opacity-0 drop-shadow-[0_2px_18px_rgba(255,255,255,0.95)] [animation:fade-in_0.9s_0.35s_forwards] md:text-7xl">
          {heroCopy.h1}
        </h1>

        <p className="mt-5 font-mono text-4xl tracking-[0.22em] text-ink-deep/80 uppercase opacity-0 drop-shadow-[0_2px_16px_rgba(255,255,255,0.95)] [animation:fade-in_0.9s_0.5s_forwards] md:text-5xl">
          Mono Design
        </p>

        <p className="mt-6 max-w-2xl text-base leading-relaxed text-gray-deep text-balance opacity-0 drop-shadow-[0_1px_12px_rgba(255,255,255,0.95)] [animation:fade-in_0.9s_0.65s_forwards] md:text-lg">
          {heroCopy.subheading}
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 opacity-0 sm:flex-row [animation:fade-in_0.9s_0.85s_forwards]">
          <a
            href="#consultation"
            className="group inline-flex items-center gap-2.5 rounded-full bg-olive-deep px-8 py-4 text-sm font-medium tracking-wide text-white shadow-[0_12px_32px_-14px_rgba(82,92,47,0.8)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink-deep hover:shadow-[0_18px_44px_-16px_rgba(15,15,15,0.5)] focus-visible:ring-2 focus-visible:ring-olive-deep focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {heroCopy.primaryCta}
            <ArrowIcon className="transition-transform duration-300 group-hover:translate-x-1" />
          </a>
          <a
            href="#projects"
            className="group inline-flex items-center gap-2.5 rounded-full border border-ink/25 px-8 py-4 text-sm font-medium tracking-wide text-ink-deep transition-all duration-300 hover:-translate-y-0.5 hover:border-ink/60 hover:bg-white/80 hover:shadow-[0_14px_36px_-18px_rgba(15,15,15,0.4)] focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {heroCopy.secondaryCta}
            <ArrowIcon className="-translate-x-1.5 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
          </a>
        </div>
      </div>
    </section>
  );
}
