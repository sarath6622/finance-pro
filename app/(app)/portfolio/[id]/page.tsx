import Container from "@mui/material/Container";
import { HoldingScreen } from "./HoldingScreen";

export const dynamic = "force-dynamic";

export default function HoldingDetailPage({ params }: { params: { id: string } }) {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <HoldingScreen id={params.id} />
    </Container>
  );
}
