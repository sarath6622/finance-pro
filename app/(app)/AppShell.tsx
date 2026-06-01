"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Paper from "@mui/material/Paper";
import Slide from "@mui/material/Slide";
import useScrollTrigger from "@mui/material/useScrollTrigger";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import DashboardIcon from "@mui/icons-material/SpaceDashboardOutlined";
import AccountsIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import AddIcon from "@mui/icons-material/AddCircle";
import LendingIcon from "@mui/icons-material/HandshakeOutlined";
import MoreIcon from "@mui/icons-material/MoreHorizOutlined";
import MenuIcon from "@mui/icons-material/MenuRounded";
import { ThemeToggleButton } from "@/components/ThemeToggle";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { UpdateBanner } from "@/components/pwa/UpdateBanner";
import { DailyReminderScheduler } from "@/components/pwa/DailyReminderScheduler";

interface NavItem {
  href: string;
  label: string;
}

const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/accounts", label: "Accounts" },
  { href: "/add", label: "Add" },
  { href: "/lending", label: "Lending" },
];

const SECONDARY_NAV: NavItem[] = [
  { href: "/splits", label: "Splits" },
  { href: "/debts", label: "Debts" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/recurring", label: "Recurring" },
  { href: "/budgets", label: "Budgets" },
  { href: "/settings", label: "Settings" },
  { href: "/debug", label: "Debug" },
];

const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function activePrimaryHref(pathname: string | null): string | false {
  if (!pathname) return false;
  for (const item of PRIMARY_NAV) {
    if (isActive(pathname, item.href)) return item.href;
  }
  return false;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hideBottomNav = useScrollTrigger({
    disableHysteresis: false,
    threshold: 80,
  });

  return (
    <>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        <Toolbar sx={{ gap: { xs: 1, md: 2 }, minHeight: { xs: 56, md: 64 } }}>
          {!isDesktop && (
            <IconButton
              edge="start"
              aria-label="Open menu"
              onClick={() => setDrawerOpen(true)}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography
            component={Link}
            href={"/" as never}
            variant="h3"
            sx={{ textDecoration: "none", color: "inherit", flexShrink: 0 }}
          >
            Finance
          </Typography>
          {isDesktop && (
            <Stack direction="row" spacing={1} sx={{ flexGrow: 1, overflow: "auto" }}>
              {ALL_NAV.map((n) => (
                <Button
                  key={n.href}
                  component={Link}
                  href={n.href as never}
                  color={isActive(pathname, n.href) ? "primary" : "inherit"}
                  variant={isActive(pathname, n.href) ? "contained" : "text"}
                  size="small"
                >
                  {n.label}
                </Button>
              ))}
            </Stack>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <InstallPrompt />
          <ThemeToggleButton />
          {isDesktop && (
            <Button size="small" color="inherit" onClick={() => signOut({ callbackUrl: "/" })}>
              Sign out
            </Button>
          )}
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
        PaperProps={{ sx: { width: 260 } }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h3">Finance</Typography>
        </Box>
        <Divider />
        <List>
          {ALL_NAV.map((n) => (
            <ListItemButton
              key={n.href}
              component={Link}
              href={n.href as never}
              selected={isActive(pathname, n.href)}
              onClick={() => setDrawerOpen(false)}
            >
              <ListItemText primary={n.label} />
            </ListItemButton>
          ))}
        </List>
        <Divider />
        <List>
          <ListItemButton onClick={() => signOut({ callbackUrl: "/" })}>
            <ListItemText primary="Sign out" />
          </ListItemButton>
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{ pb: { xs: "calc(64px + env(safe-area-inset-bottom))", md: 4 } }}
      >
        {children}
      </Box>

      <UpdateBanner />
      <DailyReminderScheduler />

      {!isDesktop && (
        <Slide appear={false} direction="up" in={!hideBottomNav}>
          <Paper
            elevation={3}
            sx={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: (t) => t.zIndex.appBar,
              borderTop: 1,
              borderColor: "divider",
              pb: "env(safe-area-inset-bottom)",
            }}
          >
            <BottomNavigation
              value={activePrimaryHref(pathname) || ""}
              showLabels
              sx={{
                bgcolor: "transparent",
                "& .MuiBottomNavigationAction-root": {
                  transition: (t) =>
                    t.transitions.create(["color", "transform"], {
                      duration: t.transitions.duration.shorter,
                    }),
                },
                "& .MuiBottomNavigationAction-root .MuiSvgIcon-root": {
                  transition: (t) =>
                    t.transitions.create("transform", {
                      duration: t.transitions.duration.shorter,
                    }),
                },
                "& .MuiBottomNavigationAction-root.Mui-selected .MuiSvgIcon-root": {
                  transform: "scale(1.15)",
                },
                "& .MuiBottomNavigationAction-root:active .MuiSvgIcon-root": {
                  transform: "scale(0.92)",
                },
              }}
            >
              <BottomNavigationAction
                component={Link}
                href={"/dashboard" as never}
                value="/dashboard"
                label="Home"
                icon={<DashboardIcon />}
              />
              <BottomNavigationAction
                component={Link}
                href={"/accounts" as never}
                value="/accounts"
                label="Accounts"
                icon={<AccountsIcon />}
              />
              <BottomNavigationAction
                component={Link}
                href={"/add" as never}
                value="/add"
                label="Add"
                icon={<AddIcon />}
              />
              <BottomNavigationAction
                component={Link}
                href={"/lending" as never}
                value="/lending"
                label="Lending"
                icon={<LendingIcon />}
              />
              <BottomNavigationAction
                value="more"
                label="More"
                icon={<MoreIcon />}
                onClick={() => setDrawerOpen(true)}
              />
            </BottomNavigation>
          </Paper>
        </Slide>
      )}
    </>
  );
}
