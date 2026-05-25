// src/api/rag-api.ts (Future RAG endpoints)
import { ragAPI } from "./apiInstance.ts";
import useSessionStore from "../store/sessionStore.ts";
import type { GitRequestSchema } from "../components/GitDialog.tsx";

export const uploadDocument = async (
  files: File[],
  sessionId: string,
  kbId: string,
) => {
  const formData = new FormData();
  files.forEach((file, index) => {
    if (file instanceof File) {
      formData.append("files", file);
    } else {
      console.warn(`Skipping invalid file at index ${index}`, file);
    }
  });

  formData.append("session_id", sessionId);
  formData.append("kb_id", kbId);

  try {
    const response = await ragAPI.post("/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    if (response.status === 200) {
      useSessionStore.getState().setContext("notes");
    }

    return response;
  } catch (error) {
    console.log(`error has occured : ${error}`);
  }
};

export const gitFilesUpload = async (
  body: GitRequestSchema,
  session_id: string | null,
  kb_id: string | null,
) => {
  const res = await ragAPI.post(
    `/git?session_id=${session_id}&kb_id=${kb_id}`,
    body,
    {
      headers: { "Content-Type": "application/json" },
    },
  );

  if (res.status === 200) {
    useSessionStore.getState().setContext("code");
  }

  return res.data;
};

export const getKbStatus = async (kb_id: string) => {
  const res = await ragAPI.get(`/status?kb_id=${kb_id}&_t=${Date.now()}`);
  return res.data;
};
export const getMockKbStatus = async (kb_id: string) => {
  const res = await ragAPI.get(`/mock/status?kb_id=${kb_id}&_t=${Date.now()}`);
  return res.data;
};
