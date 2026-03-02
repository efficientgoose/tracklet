import { createBrowserRouter, Outlet } from "react-router";
import { Layout } from "./components/Layout";
import { AppProvider } from "./contexts/AppContext";
import Timer from "./pages/Timer";
import Analytics from "./pages/Analytics";

function Root() {
  return (
    <AppProvider>
      <Layout>
        <Outlet />
      </Layout>
    </AppProvider>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      {
        index: true,
        Component: Timer,
      },
      {
        path: "analytics",
        Component: Analytics,
      },
    ],
  },
]);
