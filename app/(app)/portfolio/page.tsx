import Container from "@mui/material/Container";
import { PortfolioScreen } from "./PortfolioScreen";

export const dynamic = "force-dynamic";

export default function PortfolioPage() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <PortfolioScreen />
    </Container>
  );
}
