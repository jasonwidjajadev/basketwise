import CategoryGrid from '@/components/home/CategoryGrid'
import EssentialsSection from '@/components/home/EssentialsSection'
import FaqSection from '@/components/home/FaqSection'
import Hero from '@/components/home/Hero'
import HomeGuestBar from '@/components/home/HomeGuestBar'
import HowItWorks from '@/components/home/HowItWorks'
import MealsSection from '@/components/home/MealsSection'
import StartAnotherWay from '@/components/home/StartAnotherWay'

export default function HomePage() {
  return (
    <div>
      <HomeGuestBar />

      <main className="w-full px-6 lg:px-8 xl:px-12 2xl:px-16">
        <div className="mx-auto w-full max-w-7xl">
          <Hero />
          {/* <HowItWorks /> */}
          <StartAnotherWay />
          <EssentialsSection />
          <CategoryGrid />
          <MealsSection />
          <FaqSection />
        </div>
      </main>
    </div>
  )
}