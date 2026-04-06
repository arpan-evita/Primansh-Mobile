import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

// Lazy Load Pages
const MessagesPage = lazy(() => import("./app/messages/page"));
const BlogsPage = lazy(() => import("./app/blogs/page"));
const BlogEditor = lazy(() => import("./app/blogs/editor/page"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const MeetingRoom = lazy(() => import("./app/meeting/page"));
const MeetingsPage = lazy(() => import("./app/meetings/page"));

// Admin Pages
const Dashboard = lazy(() => import("./app/dashboard/page"));
const CaseStudiesAdmin = lazy(() => import("./app/dashboard/case-studies/page"));
const Analytics = lazy(() => import("./app/analytics/page"));
const Billing = lazy(() => import("./app/billing/page"));
const Clients = lazy(() => import("./app/clients/page"));
const ClientDetail = lazy(() => import("./app/clients/[id]/page"));
const Content = lazy(() => import("./app/content/page"));
const Documents = lazy(() => import("./app/documents/page"));
const SEO = lazy(() => import("./app/seo/page"));
const Tasks = lazy(() => import("./app/tasks/page"));
const Team = lazy(() => import("./app/team/page"));
const TestimonialsAdmin = lazy(() => import("./app/content/testimonials/page"));
const Leads = lazy(() => import("./app/leads/page"));
const PortalDashboard = lazy(() => import("./app/portal/[id]/page"));
const InvoiceDetail = lazy(() => import("./app/portal/InvoiceDetail"));
const ProfilePage = lazy(() => import("./app/profile/page"));

import { CallManager } from "./components/meetings/CallManager";
import ScrollToTop from "./components/layout/ScrollToTop";
import "./app/globals.css";

const queryClient = new QueryClient();

const LoadingScreen = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-50">
    <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
  </div>
);

const RootRedirect = () => {
  const { session, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  
  if (profile?.role === 'client' && profile.associated_client_id) {
    return <Navigate to={`/clientportal/${profile.associated_client_id}`} replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner position="top-right" expand={true} richColors />
          <BrowserRouter>
            <ScrollToTop />
            <CallManager />
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                {/* Root Route - Smart Redirect */}
                <Route path="/" element={<RootRedirect />} />
                
                {/* Public Auth Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* Admin Routes (Protected) */}
                <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['admin', 'seo', 'content', 'developer', 'team']}><Dashboard /></ProtectedRoute>} />
                <Route path="/dashboard/case-studies" element={<ProtectedRoute allowedRoles={['admin', 'seo', 'content', 'developer']}><CaseStudiesAdmin /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute allowedRoles={['admin', 'seo', 'developer']}><Analytics /></ProtectedRoute>} />
                <Route path="/billing" element={<ProtectedRoute allowedRoles={['admin', 'seo', 'developer']}><Billing /></ProtectedRoute>} />
                <Route path="/clients" element={<ProtectedRoute allowedRoles={['admin', 'seo', 'content', 'developer', 'team']}><Clients /></ProtectedRoute>} />
                <Route path="/clients/:id" element={<ProtectedRoute allowedRoles={['admin', 'seo', 'content', 'developer', 'team']}><ClientDetail /></ProtectedRoute>} />
                <Route path="/content" element={<ProtectedRoute allowedRoles={['admin', 'content', 'seo', 'developer']}><Content /></ProtectedRoute>} />
                <Route path="/content/testimonials" element={<ProtectedRoute allowedRoles={['admin', 'content', 'seo', 'developer']}><TestimonialsAdmin /></ProtectedRoute>} />
                <Route path="/blogs" element={<ProtectedRoute allowedRoles={['admin', 'content', 'seo', 'developer', 'team']}><BlogsPage /></ProtectedRoute>} />
                <Route path="/blogs/editor/:id" element={<ProtectedRoute allowedRoles={['admin', 'content', 'seo', 'developer', 'team']}><BlogEditor /></ProtectedRoute>} />
                <Route path="/documents" element={<ProtectedRoute allowedRoles={['admin', 'seo', 'content', 'developer']}><Documents /></ProtectedRoute>} />
                <Route path="/seo" element={<ProtectedRoute allowedRoles={['admin', 'seo', 'developer']}><SEO /></ProtectedRoute>} />
                <Route path="/tasks" element={<ProtectedRoute allowedRoles={['admin', 'seo', 'content', 'developer', 'team']}><Tasks /></ProtectedRoute>} />
                <Route path="/messages" element={<ProtectedRoute allowedRoles={['admin', 'seo', 'content', 'developer', 'team']}><MessagesPage /></ProtectedRoute>} />
                <Route path="/meetings" element={<ProtectedRoute allowedRoles={['admin', 'seo', 'content', 'developer', 'team']}><MeetingsPage /></ProtectedRoute>} />
                <Route path="/team" element={<ProtectedRoute allowedRoles={['admin', 'seo', 'developer']}><Team /></ProtectedRoute>} />
                <Route path="/leads" element={<ProtectedRoute allowedRoles={['admin', 'seo', 'developer']}><Leads /></ProtectedRoute>} />
                <Route path="/clientportal/:slug" element={<ProtectedRoute allowedRoles={['admin', 'seo', 'content', 'developer', 'client']}><PortalDashboard /></ProtectedRoute>} />
                <Route path="/clientportal/:slug/messages" element={<ProtectedRoute allowedRoles={['admin', 'seo', 'content', 'developer', 'client']}><MessagesPage /></ProtectedRoute>} />
                <Route path="/clientportal/:slug/meetings" element={<ProtectedRoute allowedRoles={['admin', 'seo', 'content', 'developer', 'client']}><MeetingsPage /></ProtectedRoute>} />
                <Route path="/clientportal/:slug/:subtab" element={<ProtectedRoute allowedRoles={['admin', 'seo', 'content', 'developer', 'client']}><PortalDashboard /></ProtectedRoute>} />
                <Route path="/clientportal/:slug/invoice/:invoiceId" element={<ProtectedRoute allowedRoles={['admin', 'seo', 'content', 'developer', 'client']}><InvoiceDetail /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute allowedRoles={['admin', 'seo', 'content', 'developer', 'team', 'client']}><ProfilePage /></ProtectedRoute>} />
                <Route path="/meeting/:id" element={<ProtectedRoute allowedRoles={['admin', 'seo', 'content', 'developer', 'team', 'client']}><MeetingRoom /></ProtectedRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
