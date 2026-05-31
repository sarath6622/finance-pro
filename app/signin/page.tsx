"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await signIn("owner", { redirect: false, email, password });
    setBusy(false);
    if (res?.error) {
      setError("Invalid credentials");
      return;
    }
    router.push("/debug");
  }

  return (
    <Container maxWidth="xs" sx={{ py: 8 }}>
      <Stack component="form" onSubmit={onSubmit} spacing={2}>
        <Typography variant="h2">Sign in</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" variant="contained" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </Stack>
    </Container>
  );
}
