import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Protected from "./components/Protected";
import PageTracker from "./components/PageTracker";
import SiteNotice from "./components/SiteNotice";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AuthCallback from "./pages/AuthCallback";
import Checkout from "./pages/Checkout";
import Payment from "./pages/Payment";
import Dashboard from "./pages/Dashboard";
import LeaderDashboard from "./pages/LeaderDashboard";
import LeaderLanding from "./pages/LeaderLanding";
import Scanner from "./pages/Scanner";

import AdminLayout from "./pages/admin/AdminLayout";
import Overview from "./pages/admin/Overview";
import Appearance from "./pages/admin/Appearance";
import EventConfig from "./pages/admin/EventConfig";
import AdminTickets from "./pages/admin/AdminTickets";
import AdminLots from "./pages/admin/AdminLots";
import AdminCoupons from "./pages/admin/AdminCoupons";
import AdminLeaders from "./pages/admin/AdminLeaders";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminEmails from "./pages/admin/AdminEmails";
import AdminReports from "./pages/admin/AdminReports";
import AdminSpeakers from "./pages/admin/AdminSpeakers";
import AdminCpfDiscounts from "./pages/admin/AdminCpfDiscounts";
import Integrations from "./pages/admin/Integrations";

function ParticipantRedirect({ children }) {
  const { user } = useAuth();
  if (user?.role === "lider") {
    // Auto redirect leaders to their dashboard, but allow /dashboard if explicit
    return children;
  }
  return children;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <>
      <PageTracker />
      <SiteNotice />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/l/:slug" element={<LeaderLanding />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/payment/:orderId" element={<Payment />} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/leader" element={<Protected roles={["lider", "admin"]}><LeaderDashboard /></Protected>} />
        <Route path="/scanner" element={<Protected roles={["admin", "credenciadora"]}><Scanner /></Protected>} />
        <Route path="/admin" element={<Protected roles={["admin"]}><AdminLayout /></Protected>}>
          <Route index element={<Overview />} />
          <Route path="appearance" element={<Appearance />} />
          <Route path="event" element={<EventConfig />} />
          <Route path="tickets" element={<AdminTickets />} />
          <Route path="lots" element={<AdminLots />} />
          <Route path="coupons" element={<AdminCoupons />} />
          <Route path="leaders" element={<AdminLeaders />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="emails" element={<AdminEmails />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="speakers" element={<AdminSpeakers />} />
          <Route path="cpf-discounts" element={<AdminCpfDiscounts />} />
          <Route path="integrations" element={<Integrations />} />
        </Route>
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
        <Toaster position="top-right" theme="dark" toastOptions={{ style: { background: "#0e1430", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" } }} />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
