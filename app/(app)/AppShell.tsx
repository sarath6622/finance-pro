"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";

const NAV: Array<{ href: string; label: string }> = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/accounts", label: "Accounts" },
  { href: "/add", label: "Add" },
  { href: "/lending", label: "Lending" },
  { href: "/splits", label: "Splits" },
  { href: "/debts", label: "Debts" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/recurring", label: "Recurring" },
  { href: "/budgets", label: "Budgets" },
  { href: "/settings", label: "Settings" },
  { href: "/debug", label: "Debug" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography component={Link} href={"/" as never} variant="h3" sx={{ textDecoration: "none", color: "inherit" }}>
            Finance
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexGrow: 1 }}>
            {NAV.map((n) => (
              <Button
                key={n.href}
                component={Link}
                href={n.href as never}
                color={pathname?.startsWith(n.href) ? "primary" : "inherit"}
                variant={pathname?.startsWith(n.href) ? "contained" : "text"}
                size="small"
              >
                {n.label}
              </Button>
            ))}
          </Stack>
          <Button size="small" color="inherit" onClick={() => signOut({ callbackUrl: "/" })}>
            Sign out
          </Button>
        </Toolbar>
      </AppBar>
      <Box component="main">{children}</Box>
    </>
  );
}
