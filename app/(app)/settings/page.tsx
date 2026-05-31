import Container from "@mui/material/Container";
import { SettingsScreen } from "./SettingsScreen";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <SettingsScreen />
    </Container>
  );
}
