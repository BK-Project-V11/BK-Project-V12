import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { RouterProvider } from "react-router-dom";
import "@/styles/receipt.css";
import { POSProvider } from "@/contexts/POSContext";
import { router } from "./router";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <POSProvider>
            <RouterProvider router={router} />
            <Toaster />
            <Sonner />
          </POSProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}