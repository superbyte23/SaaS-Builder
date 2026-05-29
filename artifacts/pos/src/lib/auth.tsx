import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import type { UserProfile } from "@workspace/api-client-react/src/generated/api.schemas";
import { Loader2 } from "lucide-react";

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  logout: () => void;
  setToken: (token: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(
    typeof localStorage !== "undefined" ? localStorage.getItem("nexuspos_token") : null
  );
  const [, setLocation] = useLocation();

  const { data: user, isLoading: isUserLoading, refetch } = useGetMe({
    query: {
      queryKey: ["me", token],
      enabled: !!token,
      retry: false,
    },
  });

  const logoutMutation = useLogout();

  const setToken = (newToken: string | null) => {
    if (newToken) {
      localStorage.setItem("nexuspos_token", newToken);
    } else {
      localStorage.removeItem("nexuspos_token");
    }
    setTokenState(newToken);
  };

  const logout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        setToken(null);
        setLocation("/login");
      },
    });
  };

  useEffect(() => {
    if (!token && !isUserLoading) {
      const currentPath = window.location.pathname;
      if (currentPath !== "/login" && currentPath !== "/register") {
        setLocation("/login");
      }
    }
  }, [token, isUserLoading, setLocation]);

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading: isUserLoading, logout, setToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect in AuthProvider
  }

  return <>{children}</>;
}
