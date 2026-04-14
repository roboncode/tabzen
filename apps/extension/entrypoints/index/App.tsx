import { HashRouter, Route } from "@solidjs/router";
import { lazy } from "solid-js";
import { Toaster } from "solid-sonner";

const PageList = lazy(() => import("@/pages/PageList"));
const PageDetail = lazy(() => import("@/pages/PageDetail"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));

export default function App() {
  return (
    <>
      <HashRouter>
        <Route path="/" component={PageList} />
        <Route path="/page/:pageId" component={PageDetail} />
        <Route path="/page/:pageId/:section" component={PageDetail} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/settings/:section" component={SettingsPage} />
        <Route path="*" component={PageList} />
      </HashRouter>
      <Toaster
        theme="dark"
        position="bottom-center"
        toastOptions={{
          style: {
            background: "#1e1e22",
            border: "1px solid rgba(255,255,255,0.06)",
          },
        }}
      />
      <style>{`
        [data-sonner-toast] [data-title] {
          font-size: 15px !important;
          font-weight: 600 !important;
          color: #dfdfd6 !important;
          margin-bottom: 4px !important;
        }
        [data-sonner-toast] [data-description] {
          font-size: 14px !important;
          font-weight: 400 !important;
          color: rgba(223,223,214,0.35) !important;
        }
        [data-sonner-toast] [data-button] {
          margin-left: 6px !important;
        }
      `}</style>
    </>
  );
}
