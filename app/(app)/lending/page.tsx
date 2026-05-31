import Container from "@mui/material/Container";
import { LendingScreen } from "./LendingScreen";

export const dynamic = "force-dynamic";

export default function LendingPage() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <LendingScreen />
    </Container>
  );
}
