import Container from "@mui/material/Container";
import { AddTransactionForm } from "./AddTransactionForm";

export const dynamic = "force-dynamic";

export default function AddPage() {
  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <AddTransactionForm />
    </Container>
  );
}
