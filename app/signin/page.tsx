"use client";

import { Suspense, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import { alpha, useTheme } from "@mui/material/styles";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";

const FEATURES = [
  {
    icon: AccountTreeOutlinedIcon,
    title: "Pass-through aware",
    body: "Settlements, splits, and IOUs are tracked as flows — not lumped into spending.",
  },
  {
    icon: CloudOffOutlinedIcon,
    title: "Offline-first PWA",
    body: "Log anywhere. Writes hit your device first, sync when you're back online.",
  },
  {
    icon: ShieldOutlinedIcon,
    title: "Single-owner & private",
    body: "Your data, your device. No card numbers stored — only masked last-4 labels.",
  },
] as const;

export default function SignInPage() {
  return (
    <Suspense
      fallback={<Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }} />}
    >
      <SignInScreen />
    </Suspense>
  );
}

function SignInScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await signIn("owner", { redirect: false, email, password });
    setBusy(false);
    if (res?.error) {
      setError("Those credentials didn't match. Try again.");
      return;
    }
    const callbackUrl = searchParams.get("callbackUrl");
    router.push((callbackUrl as never) ?? ("/dashboard" as never));
  }

  const brandGradient = isDark
    ? `radial-gradient(circle at 20% 20%, ${alpha(theme.palette.primary.main, 0.22)} 0%, transparent 55%),
       radial-gradient(circle at 80% 80%, ${alpha(theme.palette.primary.main, 0.12)} 0%, transparent 60%),
       linear-gradient(160deg, #050505 0%, #111111 100%)`
    : `radial-gradient(circle at 20% 20%, ${alpha(theme.palette.primary.main, 0.18)} 0%, transparent 55%),
       radial-gradient(circle at 80% 80%, ${alpha(theme.palette.secondary.main, 0.15)} 0%, transparent 60%),
       linear-gradient(160deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`;

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1.05fr 1fr" },
        bgcolor: "background.default",
      }}
    >
      {/* Brand panel */}
      <Box
        sx={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          p: { xs: 4, sm: 6, md: 8 },
          color: isDark ? "text.primary" : "#FFFFFF",
          background: brandGradient,
          overflow: "hidden",
          minHeight: { xs: 280, md: "auto" },
        }}
      >
        {/* Decorative accents */}
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            pointerEvents: "none",
          }}
        />

        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ position: "relative" }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              bgcolor: alpha("#FFFFFF", isDark ? 0.08 : 0.18),
              border: "1px solid",
              borderColor: alpha("#FFFFFF", 0.16),
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: 0.5,
            }}
          >
            ₹
          </Box>
          <Typography variant="h3" sx={{ fontWeight: 700, letterSpacing: -0.2 }}>
            Finance Tracker
          </Typography>
        </Stack>

        <Stack spacing={4} sx={{ position: "relative", maxWidth: 520 }}>
          <Stack spacing={1.5}>
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: "2rem", md: "2.5rem" },
                lineHeight: 1.15,
                fontWeight: 700,
                letterSpacing: -0.5,
              }}
            >
              Honest cash flow.<br />Built for real life.
            </Typography>
            <Typography sx={{ color: alpha("#FFFFFF", isDark ? 0.7 : 0.85), fontSize: "1.05rem" }}>
              Track money the way it actually moves — pass-through settlements, lending, splits,
              and spending, each in its own lane.
            </Typography>
          </Stack>

          <Stack spacing={2.5} sx={{ display: { xs: "none", md: "flex" } }}>
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <Stack key={f.title} direction="row" spacing={2} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1.5,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: alpha("#FFFFFF", isDark ? 0.08 : 0.18),
                      border: "1px solid",
                      borderColor: alpha("#FFFFFF", 0.16),
                      flexShrink: 0,
                    }}
                  >
                    <Icon fontSize="small" />
                  </Box>
                  <Stack spacing={0.25}>
                    <Typography sx={{ fontWeight: 600 }}>{f.title}</Typography>
                    <Typography
                      sx={{ color: alpha("#FFFFFF", isDark ? 0.65 : 0.8), fontSize: "0.9rem" }}
                    >
                      {f.body}
                    </Typography>
                  </Stack>
                </Stack>
              );
            })}
          </Stack>
        </Stack>

        <Typography
          sx={{
            position: "relative",
            color: alpha("#FFFFFF", isDark ? 0.5 : 0.75),
            fontSize: "0.8rem",
            display: { xs: "none", md: "block" },
          }}
        >
          Part of the Life OS · personal use
        </Typography>
      </Box>

      {/* Form panel */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: { xs: 3, sm: 6 },
        }}
      >
        <Box
          component="form"
          onSubmit={onSubmit}
          noValidate
          sx={{ width: "100%", maxWidth: 400 }}
        >
          <Stack spacing={1} sx={{ mb: 4 }}>
            <Typography variant="h2" sx={{ fontWeight: 700, letterSpacing: -0.3 }}>
              Welcome back
            </Typography>
            <Typography color="text.secondary">
              Sign in to continue to your finance ledger.
            </Typography>
          </Stack>

          <Stack spacing={2.5}>
            {error && (
              <Alert severity="error" variant="outlined" sx={{ borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
              fullWidth
              autoComplete="email"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <MailOutlineIcon fontSize="small" sx={{ color: "text.secondary" }} />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              autoComplete="current-password"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlinedIcon fontSize="small" sx={{ color: "text.secondary" }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((s) => !s)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? (
                        <VisibilityOffOutlinedIcon fontSize="small" />
                      ) : (
                        <VisibilityOutlinedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={busy}
              fullWidth
              sx={{
                mt: 0.5,
                py: 1.25,
                fontWeight: 600,
                fontSize: "0.95rem",
              }}
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </Stack>

          <Divider sx={{ my: 4 }} />

          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            This is a single-owner app. New accounts aren't created from this screen — credentials
            are provisioned via environment.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
