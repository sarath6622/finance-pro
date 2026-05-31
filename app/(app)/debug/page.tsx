import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import { connectMongo } from "@/lib/db/mongo";
import { AccountModel, CounterpartyModel, CategoryModel } from "@/models";
import { MoneyDisplay } from "@/components/MoneyDisplay";

export const dynamic = "force-dynamic";

export default async function DebugPage() {
  let dbError: string | null = null;
  let accounts: Array<{ name: string; kind: string; openingBalancePaise: number }> = [];
  let counterparties: Array<{ displayName: string; type: string }> = [];
  let categories: Array<{ name: string; slug: string }> = [];

  try {
    await connectMongo();
    const [a, c, k] = await Promise.all([
      AccountModel.find({}, { name: 1, kind: 1, openingBalancePaise: 1 }).lean(),
      CounterpartyModel.find({}, { displayName: 1, type: 1 }).lean(),
      CategoryModel.find({}, { name: 1, slug: 1 }).lean(),
    ]);
    accounts = a.map((d) => ({
      name: d.name,
      kind: d.kind,
      openingBalancePaise: d.openingBalancePaise ?? 0,
    }));
    counterparties = c.map((d) => ({ displayName: d.displayName, type: d.type }));
    categories = k.map((d) => ({ name: d.name, slug: d.slug }));
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Typography variant="h1">Debug — seeded data</Typography>
        {dbError && (
          <Card>
            <CardContent>
              <Typography color="error">DB error: {dbError}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Run <code>npm run seed</code> after setting MONGODB_URI in .env.local.
              </Typography>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent>
            <Typography variant="h2" gutterBottom>
              Accounts ({accounts.length})
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Kind</TableCell>
                  <TableCell align="right">Opening</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.name}>
                    <TableCell>{a.name}</TableCell>
                    <TableCell>{a.kind}</TableCell>
                    <TableCell align="right">
                      <MoneyDisplay paise={a.openingBalancePaise} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h2" gutterBottom>
              Counterparties ({counterparties.length})
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Display name</TableCell>
                  <TableCell>Type</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {counterparties.map((c) => (
                  <TableRow key={c.displayName}>
                    <TableCell>{c.displayName}</TableCell>
                    <TableCell>{c.type}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h2" gutterBottom>
              Categories ({categories.length})
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {categories.map((c) => (
                <Typography key={c.slug} variant="body2" sx={{ mr: 1.5 }}>
                  {c.name}
                </Typography>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
