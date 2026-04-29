import axios from "axios";

async function test() {
  try {
    const response = await axios.post("http://localhost:3000/api/proxy-bigwin", {
      pageSize: 10,
      pageNo: 1,
      typeId: 1,
      language: 7,
      random: "",
      signature: "",
      timestamp: ""
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
