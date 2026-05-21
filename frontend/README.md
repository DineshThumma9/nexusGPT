# 🧠 CentralGPT

**One Nexus Point to access and chat with multiple LLM providers — Mistral, Ollama, Groq, TogetherAI.**  
Supports memory, chat history, and persistent messages.

---

## 🛠 Tech Stack

| Layer         | Tech                                 |
|---------------|--------------------------------------|
| **Framework** | React                                |
| **Language**  | TypeScript                           |
| **State**     | Zustand                              |
| **Validation**| Zod                                  |
| **Networking**| Axios                                |
| **UI**        | Chakra UI                            |
| **Markdown**  | rehype plugins + React Markdown      |
| **Deployment**| Vercel                               |

---

## 🚀 Features

- 🔁 Chat across **multiple providers**
- 💾 Chat history and message persistence
- 🧠 Memory and session management
- ⚡ Fast, minimal UI with Chakra
- ✨ Markdown, syntax highlighting, GitHub-flavored markdown

---

## 🧩 Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/DineshThumma9/centralGPT.git
cd centralGPT
```
## 🧩 Setup Instructions

### 2. Install Dependencies

```bash
npm install
```
### 3. Configure Environment Variables
Create a .env file in the root directory:
```
VITE_API_URI=
```

### 4. Backend Setup (Required)
Clone and set up the backend:
```
git clone https://github.com/DineshThumma9/centralGPT-backend.git
```
Follow the backend repo instructions to configure and run it.

### 🧪 Development Scripts
```
npm run dev       # Start local dev server
npm run build     # Build for production
npm run preview   # Preview production build
```
