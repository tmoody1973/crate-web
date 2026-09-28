export default {
  providers: [
    // Production Clerk instance (pk_live_...)
    {
      domain: "https://clerk.digcrate.app",
      applicationID: "convex",
    },
    // Development Clerk instance (pk_test_...) — local-dev only.
    // Derived from NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (pk_test_<base64(domain)>).
    {
      domain: "https://known-orca-97.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
