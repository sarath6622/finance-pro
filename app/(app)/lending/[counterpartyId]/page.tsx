import Container from "@mui/material/Container";
import { PersonScreen } from "./PersonScreen";

export const dynamic = "force-dynamic";

export default function PersonPage({ params }: { params: { counterpartyId: string } }) {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <PersonScreen counterpartyId={params.counterpartyId} />
    </Container>
  );
}
