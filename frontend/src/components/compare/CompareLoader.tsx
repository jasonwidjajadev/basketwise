import { useEffect, useState } from 'react'

import logo from '@/assets/basketwise_logo/logo.svg'
import bakery from '@/assets/images/categories/bakery.png'
import fruitVegetables from '@/assets/images/categories/fruit-vegetables.png'
import meatSeafood from '@/assets/images/categories/meat-seafood.png'
import snacks from '@/assets/images/categories/snacks-confectionery.png'
import heroEssential from '@/assets/images/hero/hero-essential.png'
import heroGreens from '@/assets/images/hero/hero-greens.png'
import { cn } from '@/lib/utils'

const FRAME_MS = 400

// Six frames at FRAME_MS is one full pass in ~2.4s, just inside the 2.5s hold
// ComparePage applies -- each image gets long enough to register instead of
// strobing past. Neighbouring frames are picked to differ in colour and weight.
//
// Every one is already imported by Hero/CategoryGrid, so a visitor arriving
// from Home has them cached. hero-stilllife and hero-beetroot are deliberately
// left out: both are mostly pale wall (37% and 4% near-white pixels against a
// near-white page), which makes the mark's handles disappear while they show.
const FRAMES = [
  heroGreens,
  bakery,
  heroEssential,
  snacks,
  fruitVegetables,
  meatSeafood,
]

/**
 * Full-screen moment while the basket is being priced: the BasketWise mark,
 * centred, with grocery photography cycling inside it.
 *
 * logo.svg wraps a 1-bit PNG that carries a real alpha channel, so it can be
 * used directly as a CSS mask -- the images are clipped to the letterform.
 */
export default function CompareLoader() {
  // The flicker is driven by JS rather than CSS, so the reduced-motion
  // preference has to be read here to match how index.css treats every other
  // animation in the app.
  const [reduceMotion] = useState(
    () =>
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  )

  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (reduceMotion) return

    const interval = setInterval(
      () => setFrame((current) => (current + 1) % FRAMES.length),
      FRAME_MS,
    )

    return () => clearInterval(interval)
  }, [reduceMotion])

  return (
    <div
      role="status"
      className="fixed inset-0 z-50 flex items-center justify-center bg-bw-surface"
    >
      {/* Half the mark's native 295px -- comfortably inside it, so the mask
          bitmap's 1-bit edges stay crisp rather than stair-stepped.

          The url() MUST stay double-quoted: Vite inlines this SVG as a data
          URI whose markup carries single quotes, and an unquoted url() token
          cannot contain a quote character -- the declaration is then dropped
          wholesale and the box renders as an unmasked square. */}
      <div
        className="relative aspect-square w-[min(31vw,145px)] overflow-hidden"
        style={{
          maskImage: `url("${logo}")`,
          WebkitMaskImage: `url("${logo}")`,
          maskSize: 'contain',
          WebkitMaskSize: 'contain',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
          maskPosition: 'center',
          WebkitMaskPosition: 'center',
        }}
      >
        {/* Keeps the mark solid before the first photo has decoded, and shows
            through the transparent parts of the PNGs. */}
        <div className="absolute inset-0 bg-bw-green" />

        {FRAMES.map((src, index) => (
          <img
            key={src}
            src={src}
            alt=""
            aria-hidden="true"
            className={cn(
              'absolute inset-0 h-full w-full object-cover',
              index === frame ? 'opacity-100' : 'opacity-0',
            )}
          />
        ))}
      </div>

      <span className="sr-only">Pricing your basket…</span>
    </div>
  )
}
