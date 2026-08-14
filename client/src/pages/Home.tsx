import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Clock,
  FileText,
  Hexagon,
  MapPin,
  Network,
  Newspaper,
  Radio,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

function HexGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.78 0.15 195) 1px, transparent 1px), linear-gradient(90deg, oklch(0.78 0.15 195) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div
        className="absolute top-[10%] left-[15%] w-[500px] h-[500px] rounded-full opacity-[0.08]"
        style={{
          background: "radial-gradient(circle, oklch(0.78 0.15 195) 0%, transparent 70%)",
          filter: "blur(100px)",
          animation: "cacti-float-1 15s ease-in-out infinite",
        }}
      />
      <div
        className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] rounded-full opacity-[0.06]"
        style={{
          background: "radial-gradient(circle, oklch(0.72 0.18 155) 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "cacti-float-2 18s ease-in-out infinite",
        }}
      />
    </div>
  );
}

const features = [
  {
    icon: Newspaper,
    title: "A local reading view",
    description:
      "Generated city editions turn collected material into a readable daily overview, with links back to supporting documents.",
    color: "text-cacti-cyan",
  },
  {
    icon: FileText,
    title: "Public documents together",
    description:
      "Government pages, public records, and regional reporting sit in one searchable collection instead of scattered across separate sites.",
    color: "text-cacti-green",
  },
  {
    icon: MapPin,
    title: "Place-based browsing",
    description:
      "Map and city views help you move through the collection by the communities and places the material concerns.",
    color: "text-cacti-amber",
  },
  {
    icon: Network,
    title: "Connections across records",
    description:
      "An interactive graph shows recurring people, organizations, locations, dates, and other references found across the source material.",
    color: "text-cacti-purple",
  },
  {
    icon: Clock,
    title: "A timeline of activity",
    description:
      "A chronological view makes it easier to follow how a local subject develops across multiple documents and sources.",
    color: "text-cacti-green",
  },
  {
    icon: BarChart3,
    title: "Questions and reports",
    description:
      "The owner can ask questions about the collected material and generate working reports for further review.",
    color: "text-primary",
  },
];

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [heroVisible, setHeroVisible] = useState(false);
  const [featuresVisible, setFeaturesVisible] = useState(false);

  const primaryLabel = user ? "Open the dashboard" : "Read the newspaper";
  const primaryAction = () => setLocation(user ? "/dashboard" : "/newspaper");

  useEffect(() => {
    const heroTimer = setTimeout(() => setHeroVisible(true), 150);
    const featureTimer = setTimeout(() => setFeaturesVisible(true), 500);
    return () => {
      clearTimeout(heroTimer);
      clearTimeout(featureTimer);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Hexagon className="h-12 w-12 text-primary animate-cacti-glow-pulse" />
          <div className="flex items-center gap-2">
            <Radio className="h-3 w-3 text-cacti-green cacti-pulse" />
            <span className="text-xs text-muted-foreground tracking-wider">
              Opening The Cacti…
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <HexGrid />

      <div className="relative z-10">
        <header className="border-b border-border/30 backdrop-blur-sm sticky top-0 z-50">
          <div className="container flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Hexagon className="h-7 w-7 text-primary animate-cacti-glow-pulse" />
              <div className="flex items-center gap-2">
                <span
                  className="text-lg tracking-[0.22em] text-primary font-semibold"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  THE CACTI
                </span>
                <span className="hidden sm:inline text-xs text-muted-foreground">
                  Mohave County, Arizona
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={primaryAction}
              className="border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 transition-all"
            >
              {primaryLabel}
            </Button>
          </div>
        </header>

        <section className="container py-20 md:py-28 lg:py-32">
          <div
            className={`max-w-4xl mx-auto text-center space-y-8 transition-all duration-1000 ${
              heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <div className="flex justify-center">
              <div className="relative">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle, oklch(0.78 0.15 195 / 20%) 0%, transparent 70%)",
                    filter: "blur(30px)",
                    transform: "scale(2)",
                  }}
                />
                <Hexagon className="h-24 w-24 text-primary animate-cacti-glow-pulse relative" />
                <Activity className="h-10 w-10 text-cacti-green absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs tracking-[0.35em] text-muted-foreground uppercase">
                A local civic information project
              </p>
              <h1
                className="text-5xl md:text-7xl lg:text-8xl tracking-wider text-primary cacti-text-glow"
                style={{ fontFamily: "var(--font-display)" }}
              >
                THE CACTI
              </h1>
              <h2 className="text-lg md:text-xl text-muted-foreground">
                Public records and regional news, gathered into one place.
              </h2>
            </div>

            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              The Cacti follows local government pages, public records, and regional reporting
              across Mohave County. It organizes that material into a daily reading view, a
              searchable document collection, maps, timelines, and tools for asking careful
              questions about what has been collected.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button
                size="lg"
                onClick={primaryAction}
                className="cacti-glow text-base gap-2 h-12 px-8"
              >
                {primaryLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setLocation("/documents")}
                className="h-12 px-8"
              >
                Browse the documents
              </Button>
            </div>
          </div>
        </section>

        <section className="container pb-24">
          <div className="text-center mb-12">
            <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase mb-3">
              What you can explore
            </p>
            <h2
              className="text-2xl md:text-3xl tracking-wide text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Several ways into the same local record
            </h2>
          </div>

          <div
            className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto transition-all duration-1000 ${
              featuresVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
            }`}
          >
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="cacti-card p-6 space-y-3 group relative overflow-hidden"
                style={{ animationDelay: `${index * 100}ms`, animationFillMode: "both" }}
              >
                <feature.icon
                  className={`h-8 w-8 ${feature.color} transition-all duration-300 group-hover:scale-110`}
                />
                <h3 className="text-base text-foreground font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border/30 py-16">
          <div className="container text-center space-y-6">
            <h2
              className="text-xl md:text-2xl tracking-wide text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Start with today’s local reading view
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Generated summaries are a way into the source material, not a replacement for it.
              Follow the citations and check important claims against the original record.
            </p>
            <Button
              size="lg"
              onClick={() => setLocation("/newspaper")}
              className="cacti-glow text-base gap-2 h-12 px-8"
            >
              Read The Cacti
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <footer className="border-t border-border/30 py-8">
          <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <Hexagon className="h-4 w-4 text-primary" />
              <span>The Cacti</span>
            </div>
            <span>Built in Kingman for curious readers across Mohave County.</span>
            <span>© 2026 ScootSolute LLC</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
