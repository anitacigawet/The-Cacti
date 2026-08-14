import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { OnboardingProvider } from "./_core/hooks/useOnboarding";
import Home from "./pages/Home";
import RootRedirect from "./pages/RootRedirect";
import Dashboard from "./pages/Dashboard";
import Documents from "./pages/Documents";
import DocumentDetail from "./pages/DocumentDetail";
import EntityGraph from "./pages/EntityGraph";
import Intelligence from "./pages/Intelligence";
import Alerts from "./pages/Alerts";
import MapView from "./pages/MapView";
import TimelineView from "./pages/TimelineView";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import News from "./pages/News";
import Newspaper from "./pages/Newspaper";
import Ingestion from "./pages/Ingestion";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={RootRedirect} />
      <Route path={"/about"} component={Home} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/documents"} component={Documents} />
      <Route path={"/documents/:id"} component={DocumentDetail} />
      <Route path={"/entities"} component={EntityGraph} />
      <Route path={"/intelligence"} component={Intelligence} />
      <Route path={"/map"} component={MapView} />
      <Route path={"/timeline"} component={TimelineView} />
      <Route path={"/reports"} component={Reports} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/alerts"} component={Alerts} />
      <Route path={"/news"} component={News} />
      <Route path={"/newspaper"} component={Newspaper} />
      <Route path={"/ingestion"} component={Ingestion} />
      <Route path={"/privacy"} component={Privacy} />
      <Route path={"/terms"} component={Terms} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster
            theme="dark"
            toastOptions={{
              style: {
                background: "oklch(0.18 0.012 260)",
                border: "1px solid oklch(0.28 0.02 195 / 40%)",
                color: "oklch(0.92 0.01 195)",
              },
            }}
          />
          <OnboardingProvider>
            <Router />
          </OnboardingProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
