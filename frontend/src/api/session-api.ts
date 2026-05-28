// src/api/session-api.ts
import { sessionAPI, setupAPI } from "./apiInstance.ts";
import useAuthStore from "../store/authStore";
import useSessionStore from "../store/sessionStore";
import Session from "../entities/Session";
import useInitStore from "../store/initStore.ts";

export const apiKeySelection = async (api_prov: string, api_key: string) => {
  const data = {
    api_prov: api_prov,
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

export const llmSelection = async (providerId: string) => {
  await setupAPI.post(
    `/providers`,
    { provider: providerId },
    {
      headers: { "Content-Type": "application/json" },
    },
  );
};

export const modelSelection = async (model: string) => {
  await setupAPI.post(
    `/models`,
    { model: model },
    {
      headers: { "Content-Type": "application/json" },
    },
  );
};

export const newSession = async (session_id?: string) => {
  const access = useAuthStore.getState().accessToken;

  const payload = session_id ? { session_id } : null;

  const res = await sessionAPI.post("/new", payload, {
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
  cursor?: string;
  limit?: number;
}) => {
  const limit = data.limit || 30;
  const cursorParam = data.cursor
    ? `&cursor=${encodeURIComponent(data.cursor)}`
    : "";
  const res = await sessionAPI.get(
    `/history/${data.session_id}?limit=${limit}${cursorParam}`,
  );
  if (!res?.data) throw new Error("Session History Empty");
  // Returns { messages: [...], next_cursor: string|null, has_more: bool }
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

export const getAllSessions = async (cursor?: string, limit: number = 20) => {
  const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
  const res = await sessionAPI.get(`/getAll?limit=${limit}${cursorParam}`);
  if (!res?.data) throw new Error("No sessions found");
  // Returns { sessions: [...], next_cursor: string|null, has_more: bool }
  return res.data;
};
