import { createRoot } from "react-dom/client";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// Configure API base URL for the client
const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";
setBaseUrl(apiUrl);

// Configure auth token getter to use localStorage
// This ensures the token is sent with every API request
setAuthTokenGetter(() => {
  return localStorage.getItem('token');
});

// Global error handler for uncaught errors
window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error);
});

// Global handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

createRoot(document.getElementById("root")!).render(<App />);
