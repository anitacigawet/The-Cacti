import CactiLayout from "@/components/CactiLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Activity, FileText, AlertTriangle, ArrowRight } from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

// Mohave County city coordinates (approximate). The catch-all "Mohave
// County" marker is nudged to the north-central county to avoid stacking
// directly on Kingman (which would visually collide on narrow viewports).
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "Kingman": { lat: 35.1894, lng: -114.053 },
  "Bullhead City": { lat: 35.1478, lng: -114.5683 },
  "Lake Havasu City": { lat: 34.4839, lng: -114.3225 },
  "Mohave County": { lat: 35.65, lng: -114.0 },
  "Mohave Valley": { lat: 34.9333, lng: -114.5889 },
  "Fort Mohave": { lat: 35.0536, lng: -114.5886 },
  "Laughlin": { lat: 35.1692, lng: -114.5728 },
};

// Map projection: simple Mercator for the Mohave County region
const MAP_BOUNDS = {
  minLat: 34.2,
  maxLat: 36.0,
  minLng: -115.0,
  maxLng: -113.5,
};

function projectToCanvas(
  lat: number,
  lng: number,
  width: number,
  height: number,
  padding: number = 60
) {
  const x =
    padding +
    ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) *
      (width - padding * 2);
  const y =
    padding +
    ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) *
      (height - padding * 2);
  return { x, y };
}

interface CityData {
  name: string;
  lat: number;
  lng: number;
  docCount: number;
  alertCount: number;
  sentiment: string;
}

function MapCanvas({
  cities,
  selectedCity,
  onSelectCity,
}: {
  cities: CityData[];
  selectedCity: string | null;
  onSelectCity: (name: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 550 });
  const [hoveredCity, setHoveredCity] = useState<CityData | null>(null);
  const animFrame = useRef(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const container = canvasRef.current?.parentElement;
    if (container) {
      const obs = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        setDimensions({
          width: Math.max(400, width),
          height: Math.max(350, height),
        });
      });
      obs.observe(container);
      return () => obs.disconnect();
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function draw() {
      if (!ctx || !canvas) return;
      timeRef.current += 0.02;
      const t = timeRef.current;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = dimensions.width * dpr;
      canvas.height = dimensions.height * dpr;
      ctx.scale(dpr, dpr);

      // Background
      ctx.fillStyle = "oklch(0.12 0.015 260)";
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      // Grid
      ctx.strokeStyle = "oklch(0.18 0.01 260)";
      ctx.lineWidth = 0.5;
      for (let x = 0; x < dimensions.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, dimensions.height);
        ctx.stroke();
      }
      for (let y = 0; y < dimensions.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(dimensions.width, y);
        ctx.stroke();
      }

      // Draw county outline (simplified polygon)
      const countyPoints = [
        { lat: 36.0, lng: -114.75 },
        { lat: 36.0, lng: -113.5 },
        { lat: 35.0, lng: -113.5 },
        { lat: 34.3, lng: -114.15 },
        { lat: 34.3, lng: -114.7 },
        { lat: 34.8, lng: -114.7 },
        { lat: 35.1, lng: -114.8 },
        { lat: 35.5, lng: -114.75 },
      ];
      ctx.beginPath();
      countyPoints.forEach((p, i) => {
        const { x, y } = projectToCanvas(
          p.lat,
          p.lng,
          dimensions.width,
          dimensions.height
        );
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = "oklch(0.16 0.02 195 / 20%)";
      ctx.fill();
      ctx.strokeStyle = "oklch(0.45 0.12 195 / 40%)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw connection lines between cities
      for (let i = 0; i < cities.length; i++) {
        for (let j = i + 1; j < cities.length; j++) {
          const a = projectToCanvas(
            cities[i].lat,
            cities[i].lng,
            dimensions.width,
            dimensions.height
          );
          const b = projectToCanvas(
            cities[j].lat,
            cities[j].lng,
            dimensions.width,
            dimensions.height
          );
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `oklch(0.45 0.12 195 / ${8 + Math.sin(t + i + j) * 4}%)`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }

      // Draw cities
      for (const city of cities) {
        const { x, y } = projectToCanvas(
          city.lat,
          city.lng,
          dimensions.width,
          dimensions.height
        );
        const isSelected = selectedCity === city.name;
        const isHovered = hoveredCity?.name === city.name;
        const radius = Math.max(8, Math.min(city.docCount / 3, 30));
        const pulseRadius = radius + Math.sin(t * 2) * 3;

        // Outer glow ring
        if (isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(x, y, pulseRadius + 12, 0, Math.PI * 2);
          const grad = ctx.createRadialGradient(
            x,
            y,
            radius,
            x,
            y,
            pulseRadius + 12
          );
          grad.addColorStop(0, "oklch(0.72 0.19 195 / 30%)");
          grad.addColorStop(1, "transparent");
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Pulse ring
        const pulseAlpha = 0.3 + Math.sin(t * 3 + cities.indexOf(city)) * 0.15;
        ctx.beginPath();
        ctx.arc(x, y, pulseRadius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = `oklch(0.72 0.19 195 / ${pulseAlpha * 100}%)`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Main circle
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        const fillColor =
          city.alertCount > 3
            ? "oklch(0.65 0.25 25 / 25%)"
            : "oklch(0.72 0.19 195 / 20%)";
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.strokeStyle =
          city.alertCount > 3
            ? "oklch(0.65 0.25 25)"
            : "oklch(0.72 0.19 195)";
        ctx.lineWidth = isSelected || isHovered ? 2.5 : 1.5;
        ctx.stroke();

        // Center dot
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "oklch(0.72 0.19 195)";
        ctx.fill();

        // City label
        ctx.fillStyle = "oklch(0.88 0.02 195)";
        ctx.font = `${isSelected || isHovered ? "13px" : "11px"} 'Inter', sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(
          city.name.replace(/\b\w/g, (c) => c.toUpperCase()),
          x,
          y + radius + 16
        );

        // Doc count
        ctx.fillStyle = "oklch(0.6 0.08 195)";
        ctx.font = "9px 'Share Tech Mono', monospace";
        ctx.fillText(`${city.docCount} docs`, x, y + radius + 28);
      }

      // Title overlay
      ctx.fillStyle = "oklch(0.5 0.08 195)";
      ctx.font = "10px 'Share Tech Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText("MOHAVE COUNTY · GEOGRAPHIC INTELLIGENCE VIEW", 15, 20);

      // Coordinate labels
      ctx.fillStyle = "oklch(0.35 0.04 195)";
      ctx.font = "8px 'Share Tech Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText(`${MAP_BOUNDS.maxLat}°N`, 5, 55);
      ctx.fillText(`${MAP_BOUNDS.minLat}°N`, 5, dimensions.height - 45);
      ctx.textAlign = "center";
      ctx.fillText(`${MAP_BOUNDS.minLng}°W`, 60, dimensions.height - 5);
      ctx.fillText(
        `${MAP_BOUNDS.maxLng}°W`,
        dimensions.width - 60,
        dimensions.height - 5
      );

      animFrame.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animFrame.current);
  }, [cities, dimensions, selectedCity, hoveredCity]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const found = cities.find((city) => {
      const { x, y } = projectToCanvas(
        city.lat,
        city.lng,
        dimensions.width,
        dimensions.height
      );
      const r = Math.max(8, Math.min(city.docCount / 3, 30));
      return Math.sqrt((x - mx) ** 2 + (y - my) ** 2) < r + 10;
    });
    setHoveredCity(found || null);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredCity) {
      onSelectCity(
        selectedCity === hoveredCity.name ? null : hoveredCity.name
      );
    } else {
      onSelectCity(null);
    }
  };

  return (
    <div className="relative w-full h-[550px]">
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-lg cursor-crosshair"
        style={{ width: dimensions.width, height: dimensions.height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredCity(null)}
        onClick={handleClick}
      />
      {hoveredCity && (
        <div
          className="absolute pointer-events-none cacti-card p-3 text-xs z-10"
          style={{
            left: Math.min(
              projectToCanvas(
                hoveredCity.lat,
                hoveredCity.lng,
                dimensions.width,
                dimensions.height
              ).x + 20,
              dimensions.width - 180
            ),
            top: Math.max(
              projectToCanvas(
                hoveredCity.lat,
                hoveredCity.lng,
                dimensions.width,
                dimensions.height
              ).y - 20,
              10
            ),
            fontFamily: "var(--font-mono)",
          }}
        >
          <p className="text-foreground font-medium text-sm capitalize">
            {hoveredCity.name}
          </p>
          <div className="mt-1 space-y-0.5">
            <p className="text-muted-foreground">
              Documents: {hoveredCity.docCount}
            </p>
            <p className="text-muted-foreground">
              Alerts: {hoveredCity.alertCount}
            </p>
            <p className="text-muted-foreground capitalize">
              Sentiment: {hoveredCity.sentiment}
            </p>
            {hoveredCity.docCount > 0 && (
              <p className="text-primary/80 text-[10px] mt-1 pt-1 border-t border-border/50">
                Click marker to drill in →
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MapView() {
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const stats = trpc.analytics.metrics.useQuery();
  // Fetch first 100 documents (API max)
  const page1 = trpc.documents.list.useQuery({ limit: 100, page: 1 });
  const page2 = trpc.documents.list.useQuery({ limit: 100, page: 2 });
  const page3 = trpc.documents.list.useQuery({ limit: 100, page: 3 });

  const allItems = useMemo(() => {
    const items: any[] = [];
    if (page1.data?.items) items.push(...page1.data.items);
    if (page2.data?.items) items.push(...page2.data.items);
    if (page3.data?.items) items.push(...page3.data.items);
    return items;
  }, [page1.data, page2.data, page3.data]);

  const isLoading = page1.isLoading;

  const cityData = useMemo(() => {
    if (allItems.length === 0) return [];
    const cityMap: Record<
      string,
      { docs: number; alerts: number; sentiments: string[] }
    > = {};

    for (const doc of allItems) {
      const city = doc.city || "Mohave County";
      if (!cityMap[city]) {
        cityMap[city] = { docs: 0, alerts: 0, sentiments: [] };
      }
      cityMap[city].docs++;
      if (doc.impactLevel === "high" || doc.impactLevel === "critical") {
        cityMap[city].alerts++;
      }
      if (doc.sentiment) {
        cityMap[city].sentiments.push(doc.sentiment);
      }
    }

    return Object.entries(cityMap)
      .filter(([name]) => CITY_COORDS[name])
      .map(([name, data]) => {
        const sentimentCounts: Record<string, number> = {};
        data.sentiments.forEach((s) => {
          sentimentCounts[s] = (sentimentCounts[s] || 0) + 1;
        });
        const topSentiment =
          Object.entries(sentimentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
          "neutral";
        return {
          name,
          lat: CITY_COORDS[name].lat,
          lng: CITY_COORDS[name].lng,
          docCount: data.docs,
          alertCount: data.alerts,
          sentiment: topSentiment,
        };
      });
  }, [allItems]);

  const selectedCityData = cityData.find((c) => c.name === selectedCity);

  return (
    <CactiLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1
            className="text-xl md:text-2xl tracking-wider text-primary"
            style={{ fontFamily: "var(--font-display)" }}
          >
            MAP VIEW
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Geographic intelligence visualization of Mohave County data sources
          </p>
        </div>

        {/* Stats bar */}
        <div className="flex gap-3 flex-wrap">
          {cityData.map((city) => (
            <button
              key={city.name}
              onClick={() =>
                setSelectedCity(selectedCity === city.name ? null : city.name)
              }
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-xs ${
                selectedCity === city.name
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-card hover:border-primary/30 text-muted-foreground"
              }`}
            >
              <MapPin className="h-3 w-3" />
              <span className="capitalize">{city.name}</span>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 ml-1"
              >
                {city.docCount}
              </Badge>
            </button>
          ))}
        </div>

        {/* Map */}
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle
              className="text-xs tracking-wider text-muted-foreground uppercase flex items-center gap-2"
              style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}
            >
              <MapPin className="h-3.5 w-3.5 text-primary" />
              Geographic Intelligence Map &middot; {cityData.length} locations
              &middot;{" "}
              {cityData.reduce((sum, c) => sum + c.docCount, 0)} documents
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <Skeleton className="h-[550px]" />
            ) : cityData.length === 0 ? (
              <div className="h-[550px] flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-2">
                  <MapPin className="h-12 w-12 mx-auto opacity-30" />
                  <p>No geographic data available</p>
                </div>
              </div>
            ) : (
              <MapCanvas
                cities={cityData}
                selectedCity={selectedCity}
                onSelectCity={setSelectedCity}
              />
            )}
          </CardContent>
        </Card>

        {/* Selected city detail */}
        {selectedCityData && (
          <Card className="bg-card border-primary/20 cacti-glow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle
                  className="text-sm tracking-wider text-primary flex items-center gap-2"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  <MapPin className="h-4 w-4" />
                  <span className="capitalize">{selectedCityData.name}</span>
                  <span className="text-muted-foreground font-normal text-xs ml-2">
                    Intelligence Summary
                  </span>
                </CardTitle>
                {selectedCityData.docCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setLocation(
                        `/documents?city=${encodeURIComponent(selectedCityData.name)}`
                      )
                    }
                    className="border-primary/30 text-primary hover:bg-primary/10 gap-1.5"
                  >
                    View {selectedCityData.docCount} document
                    {selectedCityData.docCount === 1 ? "" : "s"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p
                    className="text-[10px] text-muted-foreground uppercase tracking-wider"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    Documents
                  </p>
                  <p className="text-2xl text-primary" style={{ fontFamily: "var(--font-display)" }}>
                    {selectedCityData.docCount}
                  </p>
                </div>
                <div className="space-y-1">
                  <p
                    className="text-[10px] text-muted-foreground uppercase tracking-wider"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    Alerts
                  </p>
                  <p className="text-2xl text-cacti-amber" style={{ fontFamily: "var(--font-display)" }}>
                    {selectedCityData.alertCount}
                  </p>
                </div>
                <div className="space-y-1">
                  <p
                    className="text-[10px] text-muted-foreground uppercase tracking-wider"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    Sentiment
                  </p>
                  <Badge
                    variant="outline"
                    className={`capitalize ${
                      selectedCityData.sentiment === "positive"
                        ? "text-cacti-green border-cacti-green/30"
                        : selectedCityData.sentiment === "negative"
                        ? "text-cacti-red border-cacti-red/30"
                        : "text-muted-foreground"
                    }`}
                  >
                    {selectedCityData.sentiment}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p
                    className="text-[10px] text-muted-foreground uppercase tracking-wider"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    Coordinates
                  </p>
                  <p
                    className="text-xs text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {selectedCityData.lat.toFixed(4)}°N,{" "}
                    {Math.abs(selectedCityData.lng).toFixed(4)}°W
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Legend */}
        <div className="flex items-center gap-6 justify-center text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border border-primary/60 bg-primary/20" />
            <span>Normal Activity</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border border-cacti-amber/60 bg-cacti-amber/20" />
            <span>Elevated Alerts</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-primary cacti-pulse" />
            <span>Live Monitoring</span>
          </div>
        </div>
      </div>
    </CactiLayout>
  );
}
