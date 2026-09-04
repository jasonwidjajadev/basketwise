import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router'

import heroImage1 from '@/assets/images/hero/hero-stilllife.png'
import heroImage2 from '@/assets/images/hero/hero-essential.png'
import heroImage3 from '@/assets/images/hero/hero-greens.png'

const heroImages = [heroImage1, heroImage2, heroImage3]
const IMAGE_ROTATION_MS = 4500

export default function Hero() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [activeImage, setActiveImage] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [receiptName, setReceiptName] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

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

  function selectReceipt(file?: File) {
    if (!file) {
      return
    }

    const isAcceptedFile =
      file.type === 'application/pdf' || file.type.startsWith('image/')

    if (!isAcceptedFile) {
      setReceiptName(null)
      setUploadError('Please choose a photo or PDF receipt.')
      return
    }

    setReceiptName(file.name)
    setUploadError(null)
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectReceipt(event.target.files?.[0])
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDragging(false)
    selectReceipt(event.dataTransfer.files?.[0])
  }

  return (
    <section className="grid w-full grid-cols-1 items-stretch gap-7 pt-11 pb-16 lg:grid-cols-[1.05fr_.95fr]">
      <figure className="flex min-h-[440px] w-full flex-col overflow-hidden border border-bw-line bg-[#eeece4] lg:min-h-[620px]">
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {heroImages.map((image, index) => (
            <img
              key={image}
              src={image}
              alt={
                index === 0
                  ? 'Fresh bread, vegetables and fruit arranged as a still life'
                  : 'Fresh unbranded grocery essentials'
              }
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out ${
                index === activeImage ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}
        </div>

        <figcaption className="border-t border-bw-line bg-[#f7f6f0] px-4 py-3">
          <p className="text-[12.5px] font-bold text-bw-ink">
            Fresh every week
          </p>

          <p className="mt-0.5 max-w-[58ch] text-xs leading-snug text-bw-muted">
            Compare everyday groceries across Coles, Woolworths and ALDI,
            so you know where your basket costs less.
          </p>
        </figcaption>
      </figure>

      <div className="flex min-h-[440px] flex-col justify-center border border-bw-line bg-[#f4f2ea] px-7 py-10 sm:px-12 sm:py-14 lg:min-h-[620px]">
        <p className="mb-5 text-[10.5px] font-semibold tracking-[0.2em] text-bw-subtle uppercase">
          Australia&rsquo;s grocery price companion
        </p>

        <h1
          className="max-w-[12ch] text-[2.85rem] leading-[0.96] tracking-[-0.035em] text-bw-ink sm:text-[3.6rem]"
          style={{ fontFamily: '"EB Garamond", Georgia, serif' }}
        >
          Shop <em className="italic font-semibold">smarter</em>, spend{' '}
          <em className="italic font-semibold">less</em>, on every{' '}
          <em className="italic font-semibold">weekly</em> shop.
        </h1>

        <p className="mt-6 max-w-[48ch] text-[14.5px] leading-relaxed text-bw-body">
          Upload a receipt and BasketWise will rebuild your list, find
          cheaper equivalents, and help plan the cheapest practical shop.
        </p>

        <label
          htmlFor="receipt-upload"
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`mt-8 flex min-h-[180px] cursor-pointer flex-col items-center justify-center border border-dashed px-6 py-7 text-center transition-colors ${
            isDragging
              ? 'border-bw-green bg-[#e9eee1]'
              : 'border-[#c8c6bc] bg-[#faf9f4] hover:border-bw-green hover:bg-[#f2f5ed]'
          }`}
        >
          <input
            ref={inputRef}
            id="receipt-upload"
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileChange}
            className="sr-only"
          />

          <span className="text-[15px] font-semibold text-bw-ink">
            {receiptName ?? 'Drop your receipt here'}
          </span>

          <span className="mt-1.5 text-xs text-bw-muted">
            {receiptName
              ? 'Receipt selected. You can choose another file at any time.'
              : 'Photo or PDF · drag it here or choose a file'}
          </span>

          <span className="mt-5 rounded-sm bg-bw-green px-5 py-3 text-[13px] font-semibold text-white">
            {receiptName ? 'Choose another receipt' : 'Upload receipt'}
          </span>

          {uploadError && (
            <span className="mt-3 text-xs font-medium text-red-700">
              {uploadError}
            </span>
          )}
        </label>

        <p className="mt-5 text-center text-xs text-bw-muted">
          No receipt handy?{' '}
          <Link
            to="/#essentials"
            className="font-semibold text-bw-green underline underline-offset-3 hover:text-bw-green-hover"
          >
            Start with everyday essentials
          </Link>
        </p>
      </div>
    </section>
  )
}



// import { useState } from 'react'
// import { Link } from 'react-router'

// import heroImage from '@/assets/images/hero/hero-stilllife.png'

// export default function Hero() {
//   const [isDragging, setIsDragging] = useState(false)
//   const [selectedFile, setSelectedFile] = useState<File | null>(null)

//   function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
//     event.preventDefault()
//     setIsDragging(false)

//     const file = event.dataTransfer.files?.[0]

//     if (file) {
//       setSelectedFile(file)
//     }
//   }

//   function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
//     const file = event.target.files?.[0]

//     if (file) {
//       setSelectedFile(file)
//     }
//   }

//   return (
//     <section className="grid w-full grid-cols-1 gap-7 pt-10 pb-16 lg:grid-cols-2">
//       {/* Still life */}
//       <div className="flex min-w-0 flex-col bg-[#f5f3ec]">
//         <div className="flex min-h-[420px] flex-1 items-center justify-center overflow-hidden">
//           <img
//             src={heroImage}
//             alt="Fresh bread, beetroot, tomato and lemon"
//             className="h-full min-h-[420px] w-full object-cover"
//           />
//         </div>

//         <div className="px-1 pt-3 pb-1">
//           <p className="max-w-[60ch] text-xs leading-relaxed text-bw-muted">
//             <span className="font-semibold text-bw-ink">
//               Fresh every week
//             </span>{' '}
//             We track thousands of grocery prices so you can see where your
//             weekly shop costs less.
//           </p>
//         </div>
//       </div>

//       {/* Message + receipt */}
//       <div className="flex min-w-0 flex-col justify-center bg-[#f5f3ec] px-6 py-9 sm:px-10 lg:px-11 xl:px-14">
//         <div className="mx-auto w-full max-w-[600px]">
//           <p className="mb-5 text-center text-[10px] font-medium tracking-[0.22em] text-bw-muted uppercase">
//             Australia&apos;s grocery price companion
//           </p>

//           <h1 className="text-center text-[40px] leading-[1.02] font-medium tracking-[-0.035em] text-bw-ink sm:text-[48px] xl:text-[54px]">
//             Shop <em className="italic">smarter</em>, spend{' '}
//             <em className="italic">less</em>, on every{' '}
//             <em className="italic">weekly</em> shop.
//           </h1>

//           <p className="mx-auto mt-4 max-w-[52ch] text-center text-[13px] leading-relaxed text-bw-muted sm:text-sm">
//             Upload a recent receipt and BasketWise rebuilds your list, compares
//             prices and helps plan the cheapest practical shop.
//           </p>

//           {/* Receipt dropzone */}
//           <label
//             htmlFor="receipt-upload"
//             onDragEnter={(event) => {
//               event.preventDefault()
//               setIsDragging(true)
//             }}
//             onDragOver={(event) => {
//               event.preventDefault()
//               setIsDragging(true)
//             }}
//             onDragLeave={() => setIsDragging(false)}
//             onDrop={handleDrop}
//             className={[
//               'mt-7 flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-7 text-center transition-colors',
//               isDragging
//                 ? 'border-bw-green bg-bw-green-light'
//                 : 'border-bw-line-strong bg-white/65 hover:border-bw-green',
//             ].join(' ')}
//           >
//             <input
//               id="receipt-upload"
//               type="file"
//               accept="image/*,.pdf"
//               onChange={handleFileChange}
//               className="sr-only"
//             />

//             <p className="text-[15px] font-semibold text-bw-ink">
//               {selectedFile
//                 ? selectedFile.name
//                 : 'Drop your receipt here'}
//             </p>

//             <p className="mt-1.5 text-xs text-bw-muted">
//               Photo or PDF · usually under 30 seconds
//             </p>

//             <span className="mt-5 rounded-md bg-bw-green px-5 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-bw-green-hover">
//               {selectedFile ? 'Choose another receipt' : 'Upload receipt'}
//             </span>

//             <p className="mt-5 text-[11px] leading-relaxed text-bw-subtle">
//               Receipts are processed securely and deleted after processing.
//             </p>
//           </label>

//           {/* Alternative start */}
//           <div className="mt-4">
//             <p className="mb-3 text-center text-xs text-bw-muted">
//               No receipt handy? Start from what you usually buy:
//             </p>

//             <div className="flex flex-wrap justify-center gap-2">
//               <Link
//                 to="/browse?category=dairy-eggs-fridge"
//                 className="rounded-full border border-bw-line bg-white px-4 py-2 text-xs font-medium text-bw-ink transition-colors hover:border-bw-ink"
//               >
//                 Dairy
//               </Link>

//               <Link
//                 to="/browse?category=fruit-vegetables"
//                 className="rounded-full border border-bw-line bg-white px-4 py-2 text-xs font-medium text-bw-ink transition-colors hover:border-bw-ink"
//               >
//                 Fruit &amp; Veg
//               </Link>

//               <Link
//                 to="/browse?category=meat-seafood"
//                 className="rounded-full border border-bw-line bg-white px-4 py-2 text-xs font-medium text-bw-ink transition-colors hover:border-bw-ink"
//               >
//                 Meat
//               </Link>

//               <Link
//                 to="/#essentials"
//                 className="rounded-full border border-bw-line bg-white px-4 py-2 text-xs font-medium text-bw-ink transition-colors hover:border-bw-ink"
//               >
//                 Essentials
//               </Link>

//               <Link
//                 to="/browse?category=snacks"
//                 className="rounded-full border border-bw-line bg-white px-4 py-2 text-xs font-medium text-bw-ink transition-colors hover:border-bw-ink"
//               >
//                 Snacks
//               </Link>
//             </div>
//           </div>
//         </div>
//       </div>
//     </section>
//   )
// }