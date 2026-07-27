"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { BoardCanvas } from "@/features/board/ui/board-canvas";
import { TasksBoard } from "@/features/tasks/ui/tasks-board";
import { useWorkflowStore } from "@/features/workflow/store/workflow-store";

export default function WorkspacePage() {
  const router = useRouter();
  const manifest = useWorkflowStore((s) => s.manifest);
  const activePageId = useWorkflowStore((s) => s.activePageId);

  useEffect(() => {
    if (!manifest) {
      router.replace("/");
    }
  }, [manifest, router]);

  if (!manifest || !activePageId) {
    return null;
  }

  const page = manifest.pages.find((item) => item.id === activePageId);
  if (!page) {
    return null;
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      {page.kind === "board" ? <BoardCanvas pageId={page.id} /> : null}
      {page.kind === "tasks" ? <TasksBoard pageId={page.id} /> : null}
    </main>
  );
}
