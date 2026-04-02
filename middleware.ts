import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/config/:path*",
    "/gemini/:path*",
    "/history/:path*",
    "/logs/:path*",
    "/review/:path*",
    "/select/:path*",
  ],
};
