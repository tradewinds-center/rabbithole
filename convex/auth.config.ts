export default {
  providers: [
    {
      // @convex-dev/auth Password provider issues JWTs with CONVEX_SITE_URL as issuer
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
