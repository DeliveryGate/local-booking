import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import Dashboard from "./pages/index.jsx";
import Services from "./pages/services.jsx";
import TimeSlots from "./pages/timeslots.jsx";
import Bookings from "./pages/bookings.jsx";
import Settings from "./pages/settings.jsx";

function App() {
  return (
    <AppProvider i18n={enTranslations}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/services" element={<Services />} />
          <Route path="/timeslots" element={<TimeSlots />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

createRoot(document.getElementById("root")).render(<App />);
