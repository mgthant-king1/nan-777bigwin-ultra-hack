import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import https from "https";
import { EventEmitter } from "events";

// Global stabilization for deep-level analytical stream listeners
EventEmitter.defaultMaxListeners = 0;
process.setMaxListeners(0);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize a Supreme Persistent Agent for optimal socket management
const bigwinAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  keepAliveMsecs: 1000,
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to proxy the Bigwin API
  app.post("/api/proxy-bigwin", async (req, res) => {
    try {
      const response = await axios.post(
        "https://api.bigwinqaz.com/api/webapi/GetNoaverageEmerdList",
        req.body,
        {
          timeout: 55000, // 55s timeout
          httpsAgent: bigwinAgent, // Optimize with persistent socket management
          headers: {
            "Content-Type": "application/json;charset=UTF-8",
            "Accept": "application/json, text/plain, */*",
            "Authorization": req.headers["x-proxy-auth"] ? `Bearer ${req.headers["x-proxy-auth"]}` : "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOiIxNzc2NzUyNTMwIiwibmJmIjoiMTc3Njc1MjUzMCIsImV4cCI6IjE3NzY3NTQzMzAiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL2V4cGlyYXRpb24iOiI0LzIxLzIwMjYgMToyMjoxMCBQTSIsImh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwOC8wNi9pZGVudGl0eS9jbGFpbXMvcm9sZSI6IkFjY2Vzc19Ub2tlbiIsIlVzZXJJZCI6IjYzMjIwMyIsIlVzZXJOYW1lIjoiOTU5NzUzNjE5ODc4IiwiVXNlclBob3RvIjoiMSIsIk5pY2tOYW1lIjoiTWVtYmVyTk5HRU1MQTYiLCJBbW91bnQiOiIwLjg5IiwiSW50ZWdyYWwiOiIwIiwiTG9naW5NYXJrIjoiSDUiLCJMb2dpblRpbWUiOiI0LzIxLzIwMjYgMTI6NTI6MTAgUE0iLCJMb2dpbklQQWRkcmVzcyI6IjQzLjIxNi4yLjE5NyIsIkRiTnVtYmVyIjoiMCIsIklzdmFsaWRhdG9yIjoiMCIsIktleUNvZGUiOiIxNjAiLCJUb2tlblR5cGUiOiJBY2Nlc3NfVG9rZW4iLCJQaG9uZVR5cGUiOiIxIiwiVXNlclVHlwZSI6IjAiLCJVc2VyTmFtZTIiOiIiLCJpc3MiOiJqd3RJc3N1ZXIiLCJhdWQiOiJsb3R0ZXJ5VGlja2V0In0.NKsZCroHUC8jQoj0AJ6Dqz4vAIQq_qVQPqOHM8GHh6w",
            "Ar-Origin": "https://www.777bigwingame.org",
            "Origin": "https://www.777bigwingame.org",
            "Referer": "https://www.777bigwingame.org/",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
          }
        }
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("Proxy error details:", {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data
      });
      res.status(error.response?.status || 500).json({
        error: "Failed to fetch data from Bigwin API",
        message: error.message,
        code: error.code,
        details: error.response?.data
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
