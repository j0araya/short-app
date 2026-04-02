import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const ALLOWED_EMAIL = "clipshortnews@gmail.com";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Only allow clipshortnews@gmail.com
      if (user.email === ALLOWED_EMAIL) {
        return true;
      }
      
      // Reject all other emails
      return false;
    },
    async redirect({ url, baseUrl }) {
      // After successful sign in, always redirect to dashboard
      // Unless explicitly redirecting to sign out or error page
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.includes("/api/auth/signout") || url.includes("/api/auth/error")) {
        return url;
      }
      // Default: redirect to dashboard after successful login
      return `${baseUrl}/dashboard`;
    },
    async session({ session, token }) {
      // Add user info to session
      if (session.user) {
        session.user.id = token.sub!;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
  pages: {
    signIn: "/", // Redirect to landing page on sign in
    error: "/", // Redirect to landing page on error
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
