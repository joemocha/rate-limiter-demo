const port = 9000;

export default {
  port,
  fetch() {
    // API routes would go here

    // Serve static frontend files
    return new Response("Backend server running. Frontend will be served here.");
  },
};
