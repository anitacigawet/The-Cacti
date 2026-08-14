import { Button } from "@/components/ui/button";
import { CactiLogo } from "@/components/CactiLogo";
import { Hexagon, ArrowLeft, RadioTower } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full bg-background relative overflow-hidden flex items-center justify-center px-4">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(oklch(0.78 0.15 195) 1px, transparent 1px), linear-gradient(90deg, oklch(0.78 0.15 195) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />
      {/* Glow orb */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-[0.08] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, oklch(0.78 0.15 195) 0%, transparent 70%)",
          filter: "blur(100px)",
        }}
      />
      {/* Scan lines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.5]"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, oklch(0.78 0.15 195 / 2%) 2px, oklch(0.78 0.15 195 / 2%) 4px)",
        }}
      />

      <div className="relative z-10 max-w-md w-full text-center space-y-8">
        {/* Status badge */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-md border border-cacti-amber/40 bg-cacti-amber/10 text-cacti-amber"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <RadioTower className="h-3 w-3 animate-pulse" />
          <span className="text-[10px] tracking-widest uppercase">
            Signal Lost
          </span>
        </div>

        {/* Logo */}
        <div className="flex justify-center">
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, oklch(0.78 0.15 195 / 25%) 0%, transparent 70%)",
                filter: "blur(20px)",
                transform: "scale(2)",
              }}
            />
            <Hexagon className="h-20 w-20 text-primary relative animate-cacti-glow-pulse" />
            <CactiLogo
              size={36}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1
            className="text-7xl tracking-widest text-primary cacti-text-glow"
            style={{ fontFamily: "var(--font-display)" }}
          >
            404
          </h1>
          <h2
            className="text-sm tracking-[0.3em] uppercase text-foreground/80"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Transmission Lost
          </h2>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          This route doesn&apos;t exist in the system. It may have been retired,
          renamed, or mistyped. The Cacti can&apos;t find what you&apos;re
          looking for.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button
            onClick={() => setLocation("/newspaper")}
            className="cacti-glow gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to The Cacti
          </Button>
        </div>

        <p
          className="text-[10px] tracking-widest text-muted-foreground/50 uppercase"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Cacti System · Mohave County, Arizona
        </p>
      </div>
    </div>
  );
}
