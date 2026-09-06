import { useEffect, useState } from 'react'

import logo from '@/assets/basketwise_logo/logo.svg'
import bakery from '@/assets/images/categories/bakery.png'
import dairyEggs from '@/assets/images/categories/dairy-eggs-fridge.png'
import drinks from '@/assets/images/categories/drinks.png'
import frozen from '@/assets/images/categories/frozen.png'
import fruitVegetables from '@/assets/images/categories/fruit-vegetables.png'
import meatSeafood from '@/assets/images/categories/meat-seafood.png'
import pantry from '@/assets/images/categories/pantry.png'
import snacks from '@/assets/images/categories/snacks-confectionery.png'
import heroBeetroot from '@/assets/images/hero/hero-beetroot.jpg'
import heroEssential from '@/assets/images/hero/hero-essential.png'
import heroGreens from '@/assets/images/hero/hero-greens.png'
import heroStilllife from '@/assets/images/hero/hero-stilllife.png'
import { cn } from '@/lib/utils'

const FRAME_MS = 110

// Hero shots and category shots alternate so consecutive frames never look
// alike -- that contrast is what reads as a flicker rather than a slideshow.
// Every one of these is already imported by Hero/CategoryGrid, so a visitor
// arriving from Home has them cached.
const FRAMES = [
  heroStilllife,
  bakery,
  heroGreens,
  meatSeafood,
  heroEssential,
  drinks,
  fruitVegetables,
  heroBeetroot,
  dairyEggs,
  snacks,
  pantry,
  frozen,
]

/**
 * Full-screen moment while the basket is being priced: the BasketWise mark,
 * centred, with grocery photography flickering inside it.
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
      {/* Capped at the mask bitmap's own 295px: its edges are 1-bit, so
          scaling past native size shows the stair-stepping. */}
      <div
        className="relative aspect-square w-[min(62vw,290px)] overflow-hidden"
        style={{
          maskImage: `url(${logo})`,
          WebkitMaskImage: `url(${logo})`,
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
