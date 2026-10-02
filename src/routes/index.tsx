import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/landing-page";
import { ProgressScreen } from "@/components/processing/progress-screen";
import { WorkspaceShell } from "@/components/workspace/shell";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const view = useAppStore((s) => s.view);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [view]);
  if (view === "processing") return <ProgressScreen />;
  if (view === "workspace") return <WorkspaceShell />;
  return <LandingPage />;
}
