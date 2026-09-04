import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useState,
} from 'react'
import { Link } from 'react-router'

import heroImage1 from '@/assets/images/hero/hero-stilllife.png'
import heroImage2 from '@/assets/images/hero/hero-essential.png'
import heroImage3 from '@/assets/images/hero/hero-greens.png'
import heroImage4 from '@/assets/images/hero/hero-beetroot.jpg'

const heroImages = [
  {
    src: heroImage1,
    alt: 'Fresh bread, beetroot, tomato and lemon',
  },
  {
    src: heroImage2,
    alt: 'Fresh grocery essentials',
  },
  {
    src: heroImage3,
    alt: 'Fresh leafy greens and produce',
  },
  {
    src: heroImage4,
    alt: 'Fresh beetroot and vegetables',
  },
]

const IMAGE_ROTATION_MS = 4500

export default function Hero() {
  const [activeImage, setActiveImage] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveImage((currentImage) =>
        currentImage === heroImages.length - 1
          ? 0
          : currentImage + 1,
      )
    }, IMAGE_ROTATION_MS)

    return () => window.clearInterval(intervalId)
  }, [])

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDragging(false)

    const file = event.dataTransfer.files?.[0]

    if (file) {
      setSelectedFile(file)
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (file) {
      setSelectedFile(file)
    }
  }

  return (
    <section className="grid w-full grid-cols-1 gap-7 py-10 lg:grid-cols-2">
      {/* Still life */}
      <div className="flex min-w-0 flex-col bg-[#f5f3ec]">
        <div className="relative flex min-h-[420px] flex-1 items-center justify-center overflow-hidden">
          {heroImages.map((image, index) => (
            <img
              key={image.src}
              src={image.src}
              alt={image.alt}
              aria-hidden={index !== activeImage}
              className={`absolute inset-0 h-full min-h-[420px] w-full object-cover transition-opacity duration-700 ease-in-out ${
                index === activeImage ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}
        </div>

        <div className="px-1 pt-3 pb-1">
          <p className="max-w-[60ch] text-xs leading-relaxed text-bw-muted pl-2 ">
            <span className="font-semibold text-bw-ink">
              Fresh every week
            </span>{' '}
            We track forty thousands of grocery prices so you can see where your
            weekly shop costs less.
          </p>
        </div>
      </div>

      {/* Message + receipt */}
      <div className="flex min-w-0 flex-col justify-center bg-[#f5f3ec] px-6 py-9 sm:px-10 lg:px-11 xl:px-14">
        <div className="mx-auto w-full max-w-[600px]">
          <p className="mb-5 text-center text-[10px] font-medium tracking-[0.22em] text-bw-muted uppercase">
            Australia&apos;s grocery price companion
          </p>

          <h1
            className="text-center text-[40px] leading-[1.02] tracking-[-0.035em] text-bw-ink sm:text-[48px] xl:text-[54px]"
            style={{ fontFamily: '"EB Garamond", Georgia, serif' }}
          >
            Shop <em className="font-semibold italic">smarter</em>, spend{' '}
            <em className="font-semibold italic">less</em>, on every{' '}
            <em className="font-semibold italic">weekly</em> shop.
          </h1>

          <p className="mx-auto mt-4 max-w-[52ch] text-center text-[13px] leading-relaxed text-bw-muted sm:text-sm">
            Upload a recent receipt and BasketWise rebuilds your list, compares
            prices and helps plan the cheapest practical shop.
          </p>

          {/* Receipt dropzone */}
          <label
            htmlFor="receipt-upload"
            onDragEnter={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={[
              'mt-7 flex min-h-[180px] cursor-pointer flex-col items-center justify-center border border-dashed px-6 py-7 text-center transition-colors',
              isDragging
                ? 'border-bw-green bg-bw-green-light'
                : 'border-bw-line-strong bg-white/65 hover:border-bw-green',
            ].join(' ')}
          >
            <input
              id="receipt-upload"
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="sr-only"
            />

            <p className="text-[15px] font-semibold text-bw-ink">
              {selectedFile
                ? selectedFile.name
                : 'Drop your receipt here'}
            </p>

            <p className="mt-1.5 text-xs text-bw-muted">
              Photo or PDF · usually under 30 seconds
            </p>

            <span className="mt-5 rounded-sm bg-bw-green px-5 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-bw-green-hover">
              {selectedFile ? 'Choose another receipt' : 'Upload receipt'}
            </span>

            <p className="mt-5 text-[11px] leading-relaxed text-bw-subtle">
              Receipts are processed securely and deleted after processing.
            </p>
          </label>

          {/* Alternative start */}
          <div className="mt-4">
            <p className="mb-3 text-center text-xs text-bw-muted">
              No receipt handy? Start from what you usually buy:
            </p>

            <div className="flex flex-wrap justify-center gap-2">
              <a
                href="#essentials"
                className="rounded-full border border-bw-line bg-white px-4 py-2 text-xs font-medium text-bw-ink transition-colors hover:border-bw-ink"
              >
                Essentials
              </a>

              <Link
                to="/browse?category=fruit-vegetables"
                className="rounded-full border border-bw-line bg-white px-4 py-2 text-xs font-medium text-bw-ink transition-colors hover:border-bw-ink"
              >
                Fruit &amp; Veg
              </Link>

              <Link
                to="/browse?category=dairy-eggs-fridge"
                className="rounded-full border border-bw-line bg-white px-4 py-2 text-xs font-medium text-bw-ink transition-colors hover:border-bw-ink"
              >
                Dairy
              </Link>
  
              <Link
                to="/browse?category=meat-seafood"
                className="rounded-full border border-bw-line bg-white px-4 py-2 text-xs font-medium text-bw-ink transition-colors hover:border-bw-ink"
              >
                Meat
              </Link>


              <Link
                to="/browse?category=snacks-confectionery"
                className="rounded-full border border-bw-line bg-white px-4 py-2 text-xs font-medium text-bw-ink transition-colors hover:border-bw-ink"
              >
                Snacks
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}