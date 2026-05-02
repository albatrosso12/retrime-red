import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Default to dark mode for the military aesthetic
document.documentElement.classList.add("dark");

// Set API base URL to the API server
// Update this URL to your deployed API server URL
setBaseUrl(import.meta.env.API_URL || "http://localhost:3000");

createRoot(document.getElementById("root")!).render(<App />);
