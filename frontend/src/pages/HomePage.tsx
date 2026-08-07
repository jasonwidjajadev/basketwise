import mascot from '@/assets/mascots/mascot-paper-bag.svg'

export default function HomePage() {
  return (
    <section className="flex min-h-[calc(100svh-4rem)] w-full items-center justify-center px-6 lg:px-8 xl:px-12">
      <div className="flex w-full max-w-4xl flex-col items-center text-center">
        <img
          src={mascot}
          alt=""
          className="h-60 w-60 object-contain"
        />

        <p>Home page</p>
      </div>
    </section>
  )
}