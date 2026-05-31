import Container from "@mui/material/Container";
import { RecurringScreen } from "./RecurringScreen";

export const dynamic = "force-dynamic";

export default function RecurringPage() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <RecurringScreen />
    </Container>
  );
}
