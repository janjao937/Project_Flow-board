"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { BoardCanvas } from "@/features/board/ui/board-canvas";
import { HostSessionPanel } from "@/features/join/ui/host-session-panel";
import { PlanView } from "@/features/plan/ui/plan-view";
import { RoadmapView } from "@/features/roadmap/ui/roadmap-view";
import { TasksBoard } from "@/features/tasks/ui/tasks-board";
import { useSessionStore } from "@/features/join/store/session-store";
import { useWorkflowStore } from "@/features/workflow/store/workflow-store";

export default function WorkspacePage() {
  const router = useRouter();
  const manifest = useWorkflowStore((s) => s.manifest);
  const activePageId = useWorkflowStore((s) => s.activePageId);
  const role = useSessionStore((s) => s.role);

  useEffect(() => {
    if (!manifest && role !== "guest") {
      router.replace("/");
    }
  }, [manifest, role, router]);

  if (!manifest || !activePageId) {
    return null;
  }

  const page = manifest.pages.find((item) => item.id === activePageId);
  if (!page) {
    return null;
  }

  return (
    <main className="relative flex min-h-0 flex-1 flex-col">
      <div className="absolute right-3 top-3 z-30 w-[min(100%-1.5rem,20rem)]">
        <HostSessionPanel />
      </div>
      {page.kind === "board" ? <BoardCanvas pageId={page.id} /> : null}
      {page.kind === "tasks" ? <TasksBoard pageId={page.id} /> : null}
      {page.kind === "roadmap" ? <RoadmapView pageId={page.id} /> : null}
      {page.kind === "plan" ? <PlanView pageId={page.id} /> : null}
    </main>
  );
}
