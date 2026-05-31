import Container from "@mui/material/Container";
import { SplitDetail } from "./SplitDetail";

export const dynamic = "force-dynamic";

export default function SplitDetailPage({ params }: { params: { id: string } }) {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <SplitDetail id={params.id} />
    </Container>
  );
}
