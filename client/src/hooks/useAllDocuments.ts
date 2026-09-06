import { useAuth } from "@/_core/hooks/useAuth";
import { loadAllDocumentPages } from "@/lib/document-views";
import { trpc } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";

export function useAllDocuments() {
  const utils = trpc.useUtils();
  const auth = useAuth();
  return useQuery({
    queryKey: [...getQueryKey(trpc.documents.list), { allPages: true, userId: auth.user?.id ?? null, tier: auth.tier }],
    enabled: !auth.loading,
    queryFn: ({ signal }) => loadAllDocumentPages((input) =>
      utils.client.documents.list.query({ ...input, sortBy: "date", sortOrder: "desc" }, { signal }),
    ),
  });
}
