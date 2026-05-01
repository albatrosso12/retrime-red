import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Default to dark mode for the military aesthetic
document.documentElement.classList.add("dark");

// Set API base URL to the Cloudflare Worker
setBaseUrl("https://retrime.korsetov2009.workers.dev");

createRoot(document.getElementById("root")!).render(<App />);
