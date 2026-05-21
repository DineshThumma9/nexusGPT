// src/api/session-api.ts
import { sessionAPI, setupAPI } from "./apiInstance.ts";
import useAuthStore from "../store/authStore";
import useSessionStore from "../store/sessionStore";
import Session from "../entities/Session";
import useInitStore from "../store/initStore.ts";

export const apiKeySelection = async (api_prov: string, api_key: string) => {
  const data = {
    api_prov: api_prov.toUpperCase(),
    api_key: api_key,
  };

  try {
    const res = await setupAPI.post("/init", data, {
      headers: { "Content-Type": "application/json" },
    });

    // Update the store with both API provider and API key
    useInitStore.getState().setCurrentAPIProvider(api_prov);
    useInitStore.getState().setCurrentAPIKey(api_key);

    return res.data;
  } catch (error) {
    console.error("API error in apiKeySelection:", error);
    throw error;
  }
};

export const llmSelection = async (llm_class: string) => {
  const backendProvider = llm_class
    .toLowerCase()
    .trim()
    .replace("google genai", "google_genai")
    .replace("mistral", "mistralai")
    .replace("hugging face", "huggingface");
  console.log(`Provider llm_class ${llm_class} mapped to ${backendProvider}`);
  await setupAPI.post(
    `/providers`,
    { provider: backendProvider },
    {
      headers: { "Content-Type": "application/json" },
    },
  );
};

export const modelSelection = async (model: string) => {
  console.log(`Model selection: ${model}`);
  await setupAPI.post(
    `/models`,
    { model: model },
    {
      headers: { "Content-Type": "application/json" },
    },
  );
};

export const newSession = async () => {
  const access = useAuthStore.getState().accessToken;

  const res = await sessionAPI.post("/new", null, {
    headers: { Authorization: `Bearer ${access}` },
  });

  if (!res?.data?.session_id) throw new Error("Empty session response");

  const sessionId = res.data.session_id;
  useSessionStore.getState().setCurrentSessionId(sessionId);

  return Session.parse({
    session_id: res.data.session_id,
  });
};

export const getChatHistory = async (data: {
  session_id: string;
  limit?: number;
}) => {
  const res = await sessionAPI.get(`/history/${data.session_id}`);
  if (!res?.data) throw new Error("Session History Empty");

  return res.data;
};

export const deleteSession = async (session_id: string) => {
  await sessionAPI.delete(`/${session_id}`);
};

export const updateSessionTitle = async (
  session_id: string,
  title: string,
): Promise<string> => {
  const res = await sessionAPI.patch(
    `/${session_id}/title`,
    { title },
    {
      headers: { "Content-Type": "application/json" },
    },
  );

  if (!res?.data?.title) throw new Error("Update session title failed");
  return res.data.title;
};

export const getAllSessions = async () => {
  const res = await sessionAPI.get("/getAll");
  if (!res?.data) throw new Error("No sessions found");
  return res.data;
};
