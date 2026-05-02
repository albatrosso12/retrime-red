import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";

// Ignore Chrome extension errors
window.addEventListener('error', (event) => {
  if (event.message?.includes('Could not establish connection') ||
      event.message?.includes('Receiving end does not exist')) {
    event.preventDefault();
    return false;
  }
});

// Default to dark mode for the military aesthetic
document.documentElement.classList.add("dark");

// Set API base URL to the Worker
const apiUrl = import.meta.env.VITE_API_URL || "https://retrime.korsetov2009.workers.dev";
setBaseUrl(apiUrl);

// Set auth token getter to read from localStorage
setAuthTokenGetter(() => {
  return localStorage.getItem('auth_token');
});

createRoot(document.getElementById("root")!).render(<App />);
