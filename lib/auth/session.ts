import { getServerSession, type Session } from "next-auth";
import { authOptions } from "./options";
import { unauthorized } from "@/lib/http/errors";

export async function requireSession(): Promise<Session> {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) throw unauthorized();
  return session;
}
