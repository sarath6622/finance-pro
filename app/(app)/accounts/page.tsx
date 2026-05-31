"use client";

import Link from "next/link";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import { useAccounts } from "@/lib/api/accounts";
import { MoneyDisplay } from "@/components/MoneyDisplay";

export default function AccountsPage() {
  const { data: accounts = [], isLoading, error } = useAccounts();

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Typography variant="h1">Accounts</Typography>
        {isLoading && <CircularProgress />}
        {error && (
          <Alert severity="error">
            {(error as Error).message ?? "Failed to load accounts"}
          </Alert>
        )}
        <Stack spacing={1.5}>
          {accounts.map((a) => {
            const isLiability = a.classification === "liability";
            return (
              <Card key={a._id} variant="outlined">
                <CardActionArea component={Link} href={`/accounts/${a._id}` as never}>
                  <CardContent>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      spacing={2}
                    >
                      <Box>
                        <Typography variant="h3" component="div">
                          {a.name}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} alignItems="center">
                          <Chip size="small" label={a.kind.replace("_", " ")} />
                          {a.last4Label && (
                            <Typography variant="body2" color="text.secondary">
                              …{a.last4Label}
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                      <Box textAlign="right">
                        <MoneyDisplay
                          paise={a.balancePaise}
                          size="large"
                          colorize
                          monospace
                        />
                        {isLiability && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            owed
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
          {!isLoading && accounts.length === 0 && (
            <Alert severity="info">
              No accounts yet. Run <code>npm run seed</code> to populate.
            </Alert>
          )}
        </Stack>
      </Stack>
    </Container>
  );
}
