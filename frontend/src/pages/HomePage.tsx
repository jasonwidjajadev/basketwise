import { useSearchParams } from 'react-router'
import mascot from '@/assets/mascots/mascot-paper-bag.svg'


export default function HomePage() {
  return (
    <>
    <div className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center">
      <img
        src={mascot}
        alt=""
        className="h-60 w-60 object-contain"
      />
      Home page
    </div>

    </>
  )
}
