import axios from "axios";
import https from "https";

async function test() {
  try {
    const response = await axios.post("https://api.bigwinqaz.com/api/webapi/GetNoaverageEmerdList", {
      pageSize: 10,
      pageNo: 1,
      typeId: 1,
      language: 7,
      random: "",
      signature: "",
      timestamp: ""
    }, {
      httpsAgent: new https.Agent({ family: 4, rejectUnauthorized: false }),
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "Accept": "application/json, text/plain, */*",
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOiIxNzc2NzUyNTMwIiwibmJmIjoiMTc3Njc1MjUzMCIsImV4cCI6IjE3NzY3NTQzMzAiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL2V4cGlyYXRpb24iOiI0LzIxLzIwMjYgMToyMjoxMCBQTSIsImh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwOC8wNi9pZGVudGl0eS9jbGFpbXMvcm9sZSI6IkFjY2Vzc19Ub2tlbiIsIlVzZXJJZCI6IjYzMjIwMyIsIlVzZXJOYW1lIjoiOTU5NzUzNjE5ODc4IiwiVXNlclBob3RvIjoiMSIsIk5pY2tOYW1lIjoiTWVtYmVyTk5HRU1MQTYiLCJBbW91bnQiOiIwLjg5IiwiSW50ZWdyYWwiOiIwIiwiTG9naW5NYXJrIjoiSDUiLCJMb2dpblRpbWUiOiI0LzIxLzIwMjYgMTI6NTI6MTAgUE0iLCJMb2dpbklQQWRkcmVzcyI6IjQzLjIxNi4yLjE5NyIsIkRiTnVtYmVyIjoiMCIsIklzdmFsaWRhdG9yIjoiMCIsIktleUNvZGUiOiIxNjAiLCJUb2tlblR5cGUiOiJBY2Nlc3NfVG9rZW4iLCJQaG9uZVR5cGUiOiIxIiwiVXNlclVHlwZSI6IjAiLCJVc2VyTmFtZTIiOiIiLCJpc3MiOiJqd3RJc3N1ZXIiLCJhdWQiOiJsb3R0ZXJ5VGlja2V0In0.NKsZCroHUC8jQoj0AJ6Dqz4vAIQq_qVQPqOHM8GHh6w",
        "Ar-Origin": "https://www.777bigwingame.org",
        "Origin": "https://www.777bigwingame.org",
        "Referer": "https://www.777bigwingame.org/",
      }
    });
    console.log(response.status);
    console.log(response.data);
  } catch (error: any) {
    console.log("Error status:", error.response?.status);
    console.log("Error data:", error.response?.data);
    console.log("Message:", error.message);
  }
}
test();
