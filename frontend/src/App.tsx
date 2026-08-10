import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Workspace } from "./components/Workspace";
import { WorkspaceProvider } from "./state/WorkspaceContext";

export default function App() {
  return (
    <BrowserRouter>
      <WorkspaceProvider>
        <Routes>
          <Route path="/*" element={<Workspace />} />
        </Routes>
      </WorkspaceProvider>
    </BrowserRouter>
  );
}
