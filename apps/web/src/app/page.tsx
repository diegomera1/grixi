import { LandingHeader } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { Statement } from "@/components/landing/value-proposition";
import { Showcase } from "@/components/landing/showcase";
import { CallToAction } from "@/components/landing/modules-showcase";
import { Footer } from "@/components/landing/footer";
import { LenisProvider } from "@/components/providers/lenis-provider";

export default function LandingPage() {
  return (
    <LenisProvider>
      <LandingHeader />
      <main>
        <Hero />
        <Statement />
        <Showcase />
        <CallToAction />
      </main>
      <Footer />
    </LenisProvider>
  );
}
