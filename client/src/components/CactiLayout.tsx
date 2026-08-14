import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { useSSE, SSEStatus } from "@/hooks/useSSE";
import {
  LayoutDashboard,
  FileText,
  Network,
  Brain,
  LogOut,
  PanelLeft,
  Activity,
  MapPin,
  Clock,
  BarChart3,
  Settings,
  Wifi,
  WifiOff,
  Radio,
  Newspaper,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { CactiLogo } from "./CactiLogo";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { FontToggle } from "./FontToggle";
import { OnboardingOverlay } from "./OnboardingOverlay";
import { Button } from "./ui/button";
import { TierNudge } from "./TierNudge";
import { useOnboarding } from "@/_core/hooks/useOnboarding";
import { shouldAutoStartOnboarding } from "@/_core/onboarding";

type Tier = "public" | "invited" | "owner";

const TIER_RANK: Record<Tier, number> = { public: 0, invited: 1, owner: 2 };

const allMenuItems: Array<{
  icon: React.ElementType;
  label: string;
  path: string;
  minTier: Tier;
}> = [
  { icon: Brain, label: "Intelligence", path: "/intelligence", minTier: "owner" },
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", minTier: "invited" },
  { icon: Newspaper, label: "News Feed", path: "/news", minTier: "invited" },
  { icon: Clock, label: "Timeline", path: "/timeline", minTier: "public" },
  { icon: Network, label: "Entity Graph", path: "/entities", minTier: "invited" },
  { icon: MapPin, label: "Map", path: "/map", minTier: "public" },
  { icon: BarChart3, label: "Reports", path: "/reports", minTier: "invited" },
  { icon: FileText, label: "Documents", path: "/documents", minTier: "public" },
  { icon: Settings, label: "Settings", path: "/settings", minTier: "owner" },
];

function visibleMenuItems(tier: Tier) {
  return allMenuItems.filter((item) => TIER_RANK[tier] >= TIER_RANK[item.minTier]);
}

const SIDEBAR_WIDTH_KEY = "cacti-sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

const SSE_STATUS_CONFIG: Record<SSEStatus, { color: string; label: string; icon: React.ElementType }> = {
  connected: { color: "text-cacti-green", label: "CONNECTED", icon: Wifi },
  connecting: { color: "text-cacti-amber", label: "CONNECTING", icon: Radio },
  disconnected: { color: "text-muted-foreground", label: "OFFLINE", icon: WifiOff },
  error: { color: "text-cacti-red", label: "CONNECTION ERROR", icon: WifiOff },
};

export default function CactiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <CactiLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </CactiLayoutContent>
    </SidebarProvider>
  );
}

type CactiLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function CactiLayoutContent({
  children,
  setSidebarWidth,
}: CactiLayoutContentProps) {
  const { user, tier, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const menuItems = visibleMenuItems(tier);
  const activeMenuItem = menuItems.find((item) => item.path === location);
  const isMobile = useIsMobile();
  const { status: sseStatus, eventCount, lastEvent } = useSSE();
  const sseConfig = SSE_STATUS_CONFIG[sseStatus];
  const SseIcon = sseConfig.icon;
  const { start: startOnboarding } = useOnboarding();
  const onboardingAutoStartedRef = useRef(false);

  useEffect(() => {
    if (onboardingAutoStartedRef.current) return;
    if (shouldAutoStartOnboarding(tier)) {
      onboardingAutoStartedRef.current = true;
      startOnboarding();
    }
  }, [tier, startOnboarding]);

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft =
        sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0 bg-sidebar"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b border-sidebar-border">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <button
                  onClick={() => setLocation("/newspaper")}
                  className="flex items-center gap-2 min-w-0 rounded-md px-1 -mx-1 hover:bg-sidebar-accent/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Open The Cacti newspaper"
                >
                  <CactiLogo size={20} className="shrink-0" />
                  <span
                    className="font-semibold tracking-widest text-primary truncate text-sm"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Cacti
                  </span>
                </button>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 pt-2">
            <SidebarMenu className="px-2 py-1 gap-1">
              {menuItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal ${
                        isActive
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "hover:bg-sidebar-accent"
                      }`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${
                          isActive ? "text-primary" : "text-muted-foreground"
                        }`}
                      />
                      <span
                        className="text-sm tracking-wide"
                        style={{ fontFamily: "var(--font-body)" }}
                      >
                        {item.label}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          {/* SSE Connection Status + System Status */}
          {!isCollapsed && (
            <div className="px-4 py-3 border-t border-sidebar-border space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <SseIcon className={`h-3 w-3 ${sseConfig.color} ${sseStatus === "connected" ? "cacti-pulse" : ""}`} />
                <span
                  className={`tracking-wide uppercase ${sseConfig.color}`}
                  style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}
                >
                  {sseConfig.label}
                </span>
                {eventCount > 0 && (
                  <span className="text-muted-foreground ml-auto" style={{ fontFamily: "var(--font-mono)", fontSize: "9px" }}>
                    {eventCount} events
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Activity className="h-3 w-3 text-cacti-green cacti-pulse" />
                <span className="tracking-wide uppercase" style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}>
                  App ready
                </span>
              </div>
            </div>
          )}

          <SidebarFooter className="p-3 border-t border-sidebar-border">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-sidebar-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Avatar className="h-8 w-8 border border-primary/30 shrink-0">
                      <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                      <p className="text-sm font-medium truncate leading-none text-foreground">
                        {user.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {user.email}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-primary/70 mt-1" style={{ fontFamily: "var(--font-mono)" }}>
                        {tier} tier
                      </p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={logout}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={() => { window.location.href = getLoginUrl(); }}
                className="w-full cacti-glow group-data-[collapsible=icon]:px-0"
                size="sm"
              >
                <CactiLogo size={16} className="group-data-[collapsible=icon]:mr-0 mr-2" />
                <span className="group-data-[collapsible=icon]:hidden">Sign in with Google</span>
              </Button>
            )}
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${
            isCollapsed ? "hidden" : ""
          }`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="bg-background">
        {isMobile && (
          <div className="flex border-b border-border h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <button
                onClick={() => setLocation("/newspaper")}
                className="flex items-center gap-2 rounded-md px-1 -mx-1 hover:bg-sidebar-accent/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Open The Cacti newspaper"
              >
                <CactiLogo size={16} />
                <span
                  className="tracking-wider text-primary text-sm"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {activeMenuItem?.label ?? "Cacti"}
                </span>
              </button>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6 cacti-scrollbar overflow-auto">
          <TierNudge />
          {children}
        </main>
        <FontToggle />
        {import.meta.env.DEV && (
          <button
            onClick={() => {
              try {
                localStorage.removeItem("cacti-onboarded");
              } catch {
                /* ignore */
              }
              startOnboarding();
            }}
            className="fixed bottom-4 right-16 z-50 h-10 px-3 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-medium hover:bg-primary/30 transition-colors shadow-lg flex items-center"
            title="Replay onboarding tour (dev)"
          >
            ▶ Tour
          </button>
        )}
        <OnboardingOverlay />

        {/* Live Data Footer — one row of status, one row of quiet identity.
            Status fragments (live + event count + last event) form a single
            scannable cluster on the left; identity (system + region + date)
            is dimmed on the right so it doesn't compete for attention. */}
        <footer
          className="border-t border-border bg-background/80 backdrop-blur px-2 sm:px-4 py-2 flex flex-col sm:flex-row items-center justify-between text-[10px] gap-1 sm:gap-0"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  sseStatus === "connected"
                    ? "bg-cacti-green animate-pulse"
                    : sseStatus === "connecting"
                      ? "bg-cacti-amber animate-pulse"
                      : "bg-muted-foreground"
                }`}
              />
              <span className={`uppercase tracking-wider ${sseConfig.color}`}>
                {sseConfig.label}
              </span>
            </div>
            {eventCount > 0 && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="hidden sm:inline">
                  {eventCount} event{eventCount === 1 ? "" : "s"}
                </span>
              </>
            )}
            {lastEvent && (
              <>
                <span className="text-muted-foreground/40 hidden md:inline">·</span>
                <span className="hidden md:inline text-muted-foreground/70">
                  last {lastEvent.type} @{" "}
                  {new Date(lastEvent.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground/60">
            <a href="/about" className="hover:text-foreground transition-colors">
              About
            </a>
            <span className="text-muted-foreground/40">·</span>
            <a href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </a>
            <span className="text-muted-foreground/40">·</span>
            <a href="/terms" className="hover:text-foreground transition-colors">
              Terms
            </a>
            <span className="text-muted-foreground/40 hidden sm:inline">·</span>
            <span className="hidden sm:inline">The Cacti</span>
          </div>
        </footer>
      </SidebarInset>
    </>
  );
}
