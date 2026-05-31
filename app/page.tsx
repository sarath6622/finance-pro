import Link from "next/link";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";

export default function HomePage() {
  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h1" gutterBottom>
            Finance Tracker
          </Typography>
          <Typography color="text.secondary">
            P0 foundation up. Log money movements with honest economic flow types — not raw bank
            lines.
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <Button component={Link} href={"/signin" as never} variant="contained">
            Sign in
          </Button>
          <Button component={Link} href={"/dashboard" as never} variant="outlined">
            Dashboard
          </Button>
          <Button component={Link} href={"/add" as never} variant="outlined">
            Add transaction
          </Button>
          <Button component={Link} href={"/accounts" as never} variant="outlined">
            Accounts
          </Button>
          <Button component={Link} href={"/budgets" as never} variant="text">
            Budgets
          </Button>
        </Stack>
      </Stack>
    </Container>
  );
}
