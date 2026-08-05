import path from "path";
import swaggerJSDoc from "swagger-jsdoc";
import { env } from "./env";

// ts-node runs this file directly from src/*.ts; `npm run build` compiles it
// into dist/*.js and `npm start` runs that instead. swagger-jsdoc reads route
// files as plain text (regex over comments, not a TS-aware parser) so the
// glob below has to match whichever extension is actually on disk at runtime
// — .ts in dev, .js in prod — or newly added routes silently stop showing up
// the moment someone runs the compiled build.
const routeExtension = path.extname(__filename) === ".ts" ? "ts" : "js";

// swagger-jsdoc's glob resolver requires forward slashes — path.join on
// Windows returns backslashes, which silently match zero files (no error,
// spec just comes back with an empty `paths` object).
const toGlob = (p: string) => p.split(path.sep).join("/");

const swaggerDefinition: swaggerJSDoc.OAS3Definition = {
  openapi: "3.0.3",
  info: {
    title: "Yajman API",
    version: "1.0.0",
    description:
      "Yajman backend API. Every route is documented via an @openapi JSDoc block placed directly above its " +
      "`router.<method>(...)` definition in src/routes/**. Adding a new route without that block means it " +
      "will NOT appear here — see the template comment at the top of src/routes/index.ts.",
  },
  servers: [
    { url: `http://localhost:${env.PORT}/api/${env.API_VERSION}`, description: "Local" },
  ],
  tags: [
    { name: "Auth", description: "OTP login, tokens" },
    { name: "Profile", description: "Logged-in user's own profile, addresses, devices" },
    { name: "Categories" }, { name: "Types" }, { name: "Tags" },
    { name: "Services" }, { name: "Addons" }, { name: "Banners" },
    { name: "Home", description: "Home screen aggregator" },
    { name: "Blogs" }, { name: "Aayojan" }, { name: "Coupons" }, { name: "Testimonials" },
    { name: "Popular Searches" }, { name: "Gallery" },
    { name: "Checkout", description: "Order creation + Razorpay payment flow" },
    { name: "Bookings", description: "Customer-facing order/booking lifecycle" },
    { name: "Pandit", description: "Pandit self-service: profile, assignments, bookings" },
    { name: "Contact" }, { name: "Notifications" }, { name: "App" },
    { name: "Admin: Users" }, { name: "Admin: Categories" }, { name: "Admin: Types" },
    { name: "Admin: Tags" }, { name: "Admin: Services" }, { name: "Admin: Temples" },
    { name: "Admin: Banners" }, { name: "Admin: Popular Searches" }, { name: "Admin: Testimonials" },
    { name: "Admin: Recommended Services" }, { name: "Admin: Blogs" }, { name: "Admin: Blog Categories" },
    { name: "Admin: Blog Authors" }, { name: "Admin: Aayojan" }, { name: "Admin: Coupons" },
    { name: "Admin: Reviews" }, { name: "Admin: Invoices" }, { name: "Admin: Pandit Assignments" },
    { name: "Admin: Pandits" }, { name: "Admin: Contact Entries" }, { name: "Admin: Dashboard" },
    { name: "Admin: Orders" }, { name: "Admin: Notifications" }, { name: "Admin: App Settings" },
    { name: "Admin: Addons" }, { name: "Admin: Gallery" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Access token from POST /auth/verify-otp. Admin/pandit-only routes need a token for a user with that role.",
      },
    },
    schemas: {
      SuccessEnvelope: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Success" },
          data: {},
          pagination: { $ref: "#/components/schemas/PaginationMeta" },
        },
      },
      PaginationMeta: {
        type: "object",
        properties: {
          page: { type: "integer", example: 1 },
          limit: { type: "integer", example: 20 },
          total: { type: "integer", example: 57 },
          total_pages: { type: "integer", example: 3 },
          has_next: { type: "boolean" },
          has_prev: { type: "boolean" },
        },
      },
      ErrorEnvelope: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: {
            type: "object",
            properties: {
              message: { type: "string", example: "Resource not found" },
              status: { type: "integer", example: 404 },
              code: { type: "string", example: "NOT_FOUND" },
              details: {
                type: "array",
                items: {
                  type: "object",
                  properties: { field: { type: "string" }, message: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
    responses: {
      NotFound: {
        description: "Resource not found",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
      },
      ValidationError: {
        description: "Request body/query failed validation",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
      },
      Unauthorized: {
        description: "Missing/invalid bearer token",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
      },
      Forbidden: {
        description: "Authenticated but not allowed to access this resource",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
      },
    },
  },
};

export const swaggerSpec = swaggerJSDoc({
  definition: swaggerDefinition,
  apis: [
    toGlob(path.join(__dirname, `../routes/**/*.${routeExtension}`)),
    toGlob(path.join(__dirname, `../routes/*.${routeExtension}`)),
  ],
});
