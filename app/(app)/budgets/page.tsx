import Container from "@mui/material/Container";
import { BudgetsScreen } from "./BudgetsScreen";

export const dynamic = "force-dynamic";

export default function BudgetsPage() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <BudgetsScreen />
    </Container>
  );
}
