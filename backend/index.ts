import path from "path";

const port = 9000;
const publicDir = path.join(import.meta.dir, "..", "frontend", "dist");

export default {
  port,
  fetch(req: Request) {
    const url = new URL(req.url);

    // API routes would go here

    // Serve static frontend files
    return new Response("Backend server running. Frontend will be served here.");
  },
};
