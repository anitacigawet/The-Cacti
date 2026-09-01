import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import "@fontsource/atkinson-hyperlegible/latin.css";
import "@fontsource/inter/latin.css";
import "@fontsource/jetbrains-mono/latin.css";
import "@fontsource/playfair-display/latin.css";
import App from "./App";
import "./index.css";
import { createDemoLink } from "@/lib/demoLink";

const queryClient = new QueryClient();

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    console.error("[API Query Error]", event.query.state.error);
  }
});

queryClient.getMutationCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    console.error("[API Mutation Error]", event.mutation.state.error);
  }
});

const trpcClient = trpc.createClient({
  links: import.meta.env.VITE_SHOWROOM_MODE === "1"
    ? [createDemoLink()]
    : [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
        }),
      ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
