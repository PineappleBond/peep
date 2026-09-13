import path from "path"
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/peep/', // 禁止修改
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          // React core — rarely changes, cached long-term
          if (id.includes("node_modules/react-dom") ||
              id.includes("node_modules/react/") ||
              id.includes("node_modules/react-router")) {
            return "vendor-react";
          }
          // UI primitives — Radix, CVA, class utilities
          if (id.includes("node_modules/@radix-ui") ||
              id.includes("node_modules/class-variance-authority") ||
              id.includes("node_modules/clsx") ||
              id.includes("node_modules/tailwind-merge")) {
            return "vendor-ui";
          }
          // Markdown rendering (react-markdown, remark-gfm)
          if (id.includes("node_modules/react-markdown") ||
              id.includes("node_modules/remark-gfm") ||
              id.includes("node_modules/remark-") ||
              id.includes("node_modules/rehype-") ||
              id.includes("node_modules/mdast-") ||
              id.includes("node_modules/hast-") ||
              id.includes("node_modules/micromark") ||
              id.includes("node_modules/decode-named-character-reference")) {
            return "vendor-markdown";
          }
          // State & data — Zustand + Dexie
          if (id.includes("node_modules/zustand") ||
              id.includes("node_modules/dexie")) {
            return "vendor-data";
          }
          // Date utilities
          if (id.includes("node_modules/date-fns")) {
            return "vendor-date";
          }
          // Icons
          if (id.includes("node_modules/lucide-react")) {
            return "vendor-icons";
          }
          // Toast
          if (id.includes("node_modules/sonner")) {
            return "vendor-toast";
          }
          // ByteMD editor — only on document edit page
          if (id.includes("node_modules/@bytemd") || id.includes("node_modules/bytemd")) {
            return "vendor-bytemd";
          }
        },
      },
    },
    // Lower the warning threshold since we've split chunks intentionally
    chunkSizeWarningLimit: 600,
  },
})
