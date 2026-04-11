import { lazy, Suspense } from "react";
import { ChatWindowFallback } from "./ChatWindowFallback";

const LazyChatWindow = lazy(() =>
  import("./ChatWindow").then((module) => ({
    default: module.ChatWindow,
  })),
);

export function AdminCopilot() {
  return (
    <Suspense fallback={<ChatWindowFallback className="h-full rounded-none border-0" />}>
      <LazyChatWindow type="terminal" isDrawer />
    </Suspense>
  );
}
