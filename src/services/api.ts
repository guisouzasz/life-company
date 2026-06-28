import { Platform } from "react-native";

const DEV_URL = Platform.select({
  web: "http://localhost:3000",
  default: "http://10.0.2.2:3000",
});

export const BASE_URL = "https://life-company-production.up.railway.app";

console.log("==========");
console.log("BASE_URL =", BASE_URL);
console.log("DEV =", __DEV__);
console.log("==========");
