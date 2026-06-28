import { api, BASE_URL } from "../services/api";

const handleLogin = async () => {
  console.log("BASE_URL =", BASE_URL);

  if (!email.trim() || !senha.trim()) {
    Alert.alert("Preencha os campos");
    return;
  }

  try {
    const data = await api.post("/auth/login", {
      email,
      senha,
    });

    console.log(data);
  } catch (e) {
    console.log(e);
  }
};
