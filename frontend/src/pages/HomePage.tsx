import mascot from '@/assets/mascots/mascot-paper-bag.svg'

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-360 flex-col items-center justify-center px-6 lg:px-8 xl:px-10">
      <img
        src={mascot}
        alt=""
        className="h-60 w-60 object-contain"
      />

      <p>Home page</p>
    </div>
  )
}