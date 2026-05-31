import Container from "@mui/material/Container";
import { DebtsScreen } from "./DebtsScreen";

export const dynamic = "force-dynamic";

export default function DebtsPage() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <DebtsScreen />
    </Container>
  );
}
