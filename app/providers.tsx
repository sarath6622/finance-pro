"use client";

import { useState, type ReactNode } from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { theme } from "@/lib/theme";
import { ToastHost, toast } from "@/components/Toast";

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong";
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            refetchOnMount: "always",
            retry: 1,
          },
        },
        queryCache: new QueryCache({
          onError: (error, query) => {
            if (query.meta?.silent) return;
            toast.error(readErrorMessage(error));
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _vars, _ctx, mutation) => {
            if (mutation.meta?.silent) return;
            toast.error(readErrorMessage(error));
          },
          onSuccess: (_data, _vars, _ctx, mutation) => {
            const successMessage = mutation.meta?.successMessage;
            if (typeof successMessage === "string") {
              toast.success(successMessage);
            }
          },
        }),
      }),
  );
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SessionProvider>
          <QueryClientProvider client={queryClient}>
            {children}
            <ToastHost />
          </QueryClientProvider>
        </SessionProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
