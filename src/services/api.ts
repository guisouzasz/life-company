import { Platform } from "react-native";

const DEV_URL = Platform.select({
  web: "http://localhost:3000",
  default: "http://10.0.2.2:3000",
});

export const BASE_URL = __DEV__
  ? DEV_URL!
  : "https://life-company-production.up.railway.app";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request(
  path: string,
  options: RequestInit = {},
  token?: string,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, data.message || "Erro na requisição");
  }

  return data;
}

export const api = {
  get: (path: string, token?: string) =>
    request(path, { method: "GET" }, token),

  post: (path: string, body: any, token?: string) =>
    request(
      path,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      token,
    ),

  put: (path: string, body: any, token?: string) =>
    request(
      path,
      {
        method: "PUT",
        body: JSON.stringify(body),
      },
      token,
    ),

  patch: (path: string, body?: any, token?: string) =>
    request(
      path,
      {
        method: "PATCH",
        body: body ? JSON.stringify(body) : undefined,
      },
      token,
    ),

  delete: (path: string, token?: string) =>
    request(path, { method: "DELETE" }, token),
};
