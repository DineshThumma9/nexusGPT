import { setupAPI } from "./apiInstance";

export interface ApiConfig {
  provider: string;
  encrypted_key: string; // From the backend, this is actually the plaintext key
}

export const getApiConfigs = async (): Promise<ApiConfig[]> => {
  const response = await setupAPI.get("/api-config");
  return response.data;
};

export const setApiProvider = async (provider: string, apiKey: string): Promise<any> => {
  const response = await setupAPI.post("/init", {
    api_prov: provider,
    api_key: apiKey,
  });
  return response.data;
};

export const getMcpConfig = async (): Promise<any> => {
  const response = await setupAPI.get("/mcp-config");
  return response.data;
};

export const saveMcpConfig = async (config: any): Promise<any> => {
  const response = await setupAPI.post("/mcp-config", config);
  return response.data;
};

export const getApiModels = async (): Promise<Record<string, any>> => {
  const response = await setupAPI.get("/api-models");
  return response.data;
};
