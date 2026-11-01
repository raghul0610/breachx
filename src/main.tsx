import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./anchonProfessionalDesign.css";
import "./anchonLandingFoundation.css";
import "./anchonAquaDesign.css";
import "./anchonSilverSystem.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
