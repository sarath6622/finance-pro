import Container from "@mui/material/Container";
import { Dashboard } from "./Dashboard";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Dashboard />
    </Container>
  );
}
