import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import Protected from "./components/Protected";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AuthCallback from "./pages/AuthCallback";
import Checkout from "./pages/Checkout";
import Payment from "./pages/Payment";
import Dashboard from "./pages/Dashboard";
import Scanner from "./pages/Scanner";

import AdminLayout from "./pages/admin/AdminLayout";
import Overview from "./pages/admin/Overview";
import Appearance from "./pages/admin/Appearance";
import EventConfig from "./pages/admin/EventConfig";
import AdminTickets from "./pages/admin/AdminTickets";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminOrders from "./pages/admin/AdminOrders";
import Integrations from "./pages/admin/Integrations";

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/payment/:orderId" element={<Payment />} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/scanner" element={<Protected roles={["admin", "credenciadora"]}><Scanner /></Protected>} />
      <Route path="/admin" element={<Protected roles={["admin"]}><AdminLayout /></Protected>}>
        <Route index element={<Overview />} />
        <Route path="appearance" element={<Appearance />} />
        <Route path="event" element={<EventConfig />} />
        <Route path="tickets" element={<AdminTickets />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="integrations" element={<Integrations />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
        <Toaster position="top-right" theme="dark" toastOptions={{ style: { background: "#0a0c1a", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" } }} />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
