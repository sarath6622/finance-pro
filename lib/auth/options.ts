import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { verifyPassword } from "./password";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/signin" },
  providers: [
    CredentialsProvider({
      id: "owner",
      name: "Owner",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const ownerEmail = process.env.OWNER_EMAIL;
        const ownerHash = process.env.OWNER_PASSWORD_HASH;
        if (!ownerEmail || !ownerHash) return null;
        if (!credentials?.email || !credentials?.password) return null;
        if (credentials.email.toLowerCase() !== ownerEmail.toLowerCase()) return null;
        if (!verifyPassword(credentials.password, ownerHash)) return null;
        return { id: "owner", email: ownerEmail, name: "Owner" };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = "owner";
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = (token as { role?: string }).role;
      }
      return session;
    },
  },
};
