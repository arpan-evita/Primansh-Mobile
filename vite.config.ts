import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: true,
    port: 8080,
  },
  plugins: [tailwindcss(), react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll("\\", "/");

          if (normalizedId.includes("/src/lib/invoice-pdf.ts")) return "feature-pdf";

          if (!normalizedId.includes("/node_modules/")) return undefined;

          if (
            normalizedId.includes("/@tiptap/") ||
            normalizedId.includes("/prosemirror/")
          ) {
            return "vendor-editor";
          }

          if (
            normalizedId.includes("/react/") ||
            normalizedId.includes("/react-dom/") ||
            normalizedId.includes("/react-router/") ||
            normalizedId.includes("/react-router-dom/")
          ) {
            return "vendor-react";
          }

          if (
            normalizedId.includes("/@supabase/") ||
            normalizedId.includes("/@tanstack/react-query/")
          ) {
            return "vendor-data";
          }

          if (
            normalizedId.includes("/@radix-ui/") ||
            normalizedId.includes("/vaul/")
          ) {
            return "vendor-ui";
          }

          if (
            normalizedId.includes("/framer-motion/") ||
            normalizedId.includes("/cmdk/")
          ) {
            return "vendor-interactions";
          }

          if (normalizedId.includes("/recharts/")) {
            return "vendor-charts";
          }

          if (normalizedId.includes("/html2canvas/")) {
            return "vendor-pdf-renderer";
          }

          if (
            normalizedId.includes("/jspdf/") ||
            normalizedId.includes("/jspdf-autotable/")
          ) {
            return "vendor-pdf";
          }

          if (
            normalizedId.includes("/react-markdown/") ||
            normalizedId.includes("/remark-") ||
            normalizedId.includes("/mdast-") ||
            normalizedId.includes("/micromark/") ||
            normalizedId.includes("/unified/") ||
            normalizedId.includes("/hast-") ||
            normalizedId.includes("/unist-")
          ) {
            return "vendor-markdown";
          }

          return undefined;
        },
      },
    },
  },
}));
