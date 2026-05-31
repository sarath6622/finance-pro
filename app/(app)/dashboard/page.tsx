import Container from "@mui/material/Container";
import { Dashboard } from "./Dashboard";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 2, sm: 3 } }}>
      <Dashboard />
    </Container>
  );
}
