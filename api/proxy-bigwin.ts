import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await axios.post(
      "https://api.bigwinqaz.com/api/webapi/GetNoaverageEmerdList",
      req.body,
      {
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          "Accept": "application/json, text/plain, */*",
          "Authorization": req.headers['x-proxy-auth'] ? `Bearer ${req.headers['x-proxy-auth']}` : "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOiIxNzc2NzUyNTMwIiwibmJmIjoiMTc3Njc1MjUzMCIsImV4cCI6IjE3NzY3NTQzMzAiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL2V4cGlyYXRpb24iOiI0LzIxLzIwMjYgMToyMjoxMCBQTSIsImh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwOC8wNi9pZGVudGl0eS9jbGFpbXMvcm9sZSI6IkFjY2Vzc19Ub2tlbiIsIlVzZXJJZCI6IjYzMjIwMyIsIlVzZXJOYW1lIjoiOTU5NzUzNjE5ODc4IiwiVXNlclBob3RvIjoiMSIsIk5pY2tOYW1lIjoiTWVtYmVyTk5HRU1MQTYiLCJBbW91bnQiOiIwLjg5IiwiSW50ZWdyYWwiOiIwIiwiTG9naW5NYXJrIjoiSDUiLCJMb2dpblRpbWUiOiI0LzIxLzIwMjYgMTI6NTI6MTAgUE0iLCJMb2dpbklQQWRkcmVzcyI6IjQzLjIxNi4yLjE5NyIsIkRiTnVtYmVyIjoiMCIsIklzdmFsaWRhdG9yIjoiMCIsIktleUNvZGUiOiIxNjAiLCJUb2tlblR5cGUiOiJBY2Nlc3NfVG9rZW4iLCJQaG9uZVR5cGUiOiIxIiwiVXNlclVHlwZSI6IjAiLCJVc2VyTmFtZTIiOiIiLCJpc3MiOiJqd3RJc3N1ZXIiLCJhdWQiOiJsb3R0ZXJ5VGlja2V0In0.NKsZCroHUC8jQoj0AJ6Dqz4vAIQq_qVQPqOHM8GHh6w",
          "Ar-Origin": "https://www.777bigwingame.org",
          "Origin": "https://www.777bigwingame.org",
          "Referer": "https://www.777bigwingame.org/",
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
        }
      }
    );
    res.status(200).json(response.data);
  } catch (error: any) {
    console.error("Proxy error:", error.message);
    res.status(error.response?.status || 500).json({
      error: "Failed to fetch data from Bigwin API",
      message: error.message
    });
  }
}
