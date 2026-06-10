import { createContext, useContext, useEffect, useState } from "react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextType {
  user: User | null | undefined;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  // Fetch user data - always check auth status (session might still be valid even without token)
  const { data: fetchedUser, isLoading: isFetching, isError } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: 2, // Retry twice on failure
      retryDelay: 500, // Wait 500ms between retries
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnReconnect: true, // Refetch when connection is restored
      gcTime: 24 * 60 * 60 * 1000, // 24 hours
      enabled: true, // Always check auth status (session might still be valid even without token)
    },
  });

  // Update user when the backend response comes back
  useEffect(() => {
    if (!isFetching) {
      if (isError || !fetchedUser) {
        setUser(null);
        localStorage.removeItem('token');
      } else {
        setUser(fetchedUser);
      }
      setLoading(false);
    }
  }, [fetchedUser, isFetching, isError]);

  const login = (newUser: User) => {
    setUser(newUser);
    // Token should be set by the backend login response and stored by the API client
    queryClient.setQueryData(getGetMeQueryKey(), newUser);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    queryClient.setQueryData(getGetMeQueryKey(), null);
    // Clear all user-specific data on logout
    queryClient.clear();
    // Clear all cart data to prevent showing in other accounts
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('cart_')) {
        localStorage.removeItem(key);
      }
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
