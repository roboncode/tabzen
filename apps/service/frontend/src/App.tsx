import { render } from "solid-js/web";

function App() {
  return (
    <div style={{ padding: "2rem", "font-family": "system-ui, sans-serif" }}>
      <h1>TabZen Service</h1>
      <p>The local service is running. You can close this window — the service continues in the system tray.</p>
    </div>
  );
}

render(() => <App />, document.getElementById("app")!);
