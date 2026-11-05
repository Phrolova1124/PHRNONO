import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import "./styles.css";

const recoveryStyles = {
  minHeight: "100svh",
  display: "grid",
  placeItems: "center",
  padding: "24px",
  background: "#f5f5f2",
  color: "#111310",
  fontFamily: "system-ui, sans-serif",
};

const recoveryPanelStyles = {
  width: "min(100%, 520px)",
  padding: "clamp(28px, 6vw, 54px)",
  border: "1px solid #111310",
  background: "#f5f5f2",
  textAlign: "center",
};

function StartupRecovery({ canReset = false }) {
  const resetSiteData = async () => {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
      if ("caches" in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((key) => window.caches.delete(key)));
      }
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
    } catch {
      // A reload still gives the browser a chance to fetch the current app.
    }

    window.location.replace(`${window.location.pathname}${window.location.search}${window.location.hash}`);
  };

  return (
    <main style={recoveryStyles} role="alert" aria-live="assertive">
      <section style={recoveryPanelStyles}>
        <img src="/portfolio/asset-175.svg" width="76" height="76" alt="" style={{ display: "block", width: 76, height: 76, margin: "0 auto 26px" }} />
        <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, letterSpacing: "0.12em" }}>PHRNONO / VISUAL ARCHIVE</p>
        <h1 style={{ margin: "0", fontSize: "clamp(28px, 5vw, 48px)", lineHeight: 1.05 }}>页面没有完成启动</h1>
        <p style={{ margin: "22px auto 0", maxWidth: 360, color: "#565a51", fontSize: 15, lineHeight: 1.65 }}>请先重新载入。若还是无法进入，可以只重置 PHRNONO 的本机缓存与网站资料后再试。</p>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 28 }}>
          <button type="button" onClick={() => window.location.reload()} style={{ minHeight: 44, padding: "10px 16px", border: "1px solid #111310", background: "#d6f438", color: "#111310", fontWeight: 700, cursor: "pointer" }}>重新载入 ↗</button>
          {canReset && <button type="button" onClick={() => { void resetSiteData(); }} style={{ minHeight: 44, padding: "10px 16px", border: "1px solid #111310", background: "#f5f5f2", color: "#111310", fontWeight: 700, cursor: "pointer" }}>重置本网站资料</button>}
        </div>
      </section>
    </main>
  );
}

class StartupRecoveryBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // Preserve a browser-console trace without revealing it in the interface.
    console.error("PHRNONO startup failed", error);
  }

  render() {
    return this.state.failed ? <StartupRecovery canReset /> : this.props.children;
  }
}

const rootElement = document.getElementById("root");

createRoot(rootElement).render(
  <React.StrictMode>
    <StartupRecoveryBoundary>
      <App />
    </StartupRecoveryBoundary>
  </React.StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }, { once: true });
}
