import { Navigate, Route, Routes } from "react-router-dom";
import { AuthScreen } from "./components/AuthScreen.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { EvalDashboard } from "./pages/EvalDashboard.jsx";
import { Workspace } from "./pages/Workspace.jsx";

function RequireAuth({ children }) {
  const { token, user } = useAuth();
  if (!token || !user) return <AuthScreen />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <RequireAuth>
            <Workspace />
          </RequireAuth>
        }
      />
      <Route
        path="/eval"
        element={
          <RequireAuth>
            <EvalDashboard />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
