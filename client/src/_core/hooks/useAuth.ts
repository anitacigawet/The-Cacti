import { trpc } from "@/lib/trpc";

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  avatarUrl: string | null;
  tier: "public" | "invited" | "owner";
};

export function useAuth() {
  const meQuery = trpc.auth.me.useQuery(undefined, { staleTime: 60_000 });
  const logoutMutation = trpc.auth.logout.useMutation();

  const data = meQuery.data;
  const user: AuthUser | null = data?.authenticated ? data.user : null;
  const tier = data?.tier ?? "public";

  return {
    user,
    tier,
    loading: meQuery.isLoading,
    isAuthenticated: !!user,
    isOwner: tier === "owner",
    isInvited: tier === "invited" || tier === "owner",
    error: meQuery.error,
    refresh: () => meQuery.refetch(),
    logout: async () => {
      await logoutMutation.mutateAsync();
      await meQuery.refetch();
      window.location.assign("/");
    },
    signInUrl: "/api/auth/google",
  };
}
