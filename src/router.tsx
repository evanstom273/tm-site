import { createBrowserRouter } from "react-router";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import NotFoundPage from "./pages/NotFoundPage";
import RecordPage from "./pages/RecordPage";
import TablePage from "./pages/TablePage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "t/:table", element: <TablePage /> },
      { path: "t/:table/:id", element: <RecordPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
