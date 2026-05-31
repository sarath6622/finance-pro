import Container from "@mui/material/Container";
import { SplitsScreen } from "./SplitsScreen";

export const dynamic = "force-dynamic";

export default function SplitsPage() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <SplitsScreen />
    </Container>
  );
}
