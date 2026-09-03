import CategoryGrid from '@/components/home/CategoryGrid'
import EssentialsSection from '@/components/home/EssentialsSection'
import FaqSection from '@/components/home/FaqSection'
import Hero from '@/components/home/Hero'
import HowItWorks from '@/components/home/HowItWorks'
import MealsSection from '@/components/home/MealsSection'
import StartAnotherWay from '@/components/home/StartAnotherWay'

export default function HomePage() {
  return (
    <div className="font-archivo text-bw-ink">
      <HowItWorks />
      <Hero />
      <StartAnotherWay />
      <EssentialsSection />
      <CategoryGrid />
      <MealsSection />
      <FaqSection />
    </div>
  )
}
