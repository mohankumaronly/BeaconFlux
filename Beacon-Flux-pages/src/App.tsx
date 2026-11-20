import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { TrustStrip } from './components/TrustStrip';
import { QuickStart } from './components/QuickStart';
import { FeatureGrid } from './components/FeatureGrid';
import { Providers } from './components/Providers';
import { Architecture } from './components/Architecture';
import { DemoVideo } from './components/DemoVideo';
import { FAQ } from './components/FAQ';
import { Footer } from './components/Footer';
import { ThemeProvider } from './components/ThemeProvider';

export default function App() {
  return (
    <ThemeProvider>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">
          <Hero />
          <DemoVideo />
          <TrustStrip />
          <QuickStart />
          <FeatureGrid />
          <Providers />
          <Architecture />
          <FAQ />
        </main>
        <Footer />
      </div>
    </ThemeProvider>
  );
}