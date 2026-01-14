import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { ConvexProvider } from "convex/react";
import App from "./App";
import "./styles.css";
import { createConvexClient } from "./convexClient";

const convex = createConvexClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      {convex ? (
        <ConvexProvider client={convex}>
          <App />
        </ConvexProvider>
      ) : (
        <App />
      )}
    </HashRouter>
  </React.StrictMode>
);


