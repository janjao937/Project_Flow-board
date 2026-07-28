"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LaneManager({
  lanes,
  canEdit,
  onAdd,
  onRename,
  onRemove,
  onMove,
}: {
  lanes: string[];
  canEdit: boolean;
  onAdd: (name: string) => void;
  onRename: (from: string, to: string) => void;
  onRemove: (name: string) => void;
  onMove: (name: string, direction: -1 | 1) => void;
}) {
  const t = useTranslations("roadmap");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  return (
    <div className="border-border/70 bg-background/60 rounded-xl border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{t("lanesTitle")}</h3>
        <span className="text-muted-foreground text-[11px]">
          {lanes.length} {t("items")}
        </span>
      </div>

      {lanes.length === 0 ? (
        <p className="text-muted-foreground mb-3 text-xs">{t("emptyLanes")}</p>
      ) : (
        <ul className="mb-3 space-y-1.5">
          {lanes.map((lane, index) => (
            <li key={lane} className="flex min-w-0 items-center gap-1">
              {editing === lane ? (
                <Input
                  value={editValue}
                  disabled={!canEdit}
                  className="h-8 min-w-0 flex-1"
                  aria-label={t("renameLane")}
                  onChange={(event) => setEditValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      onRename(lane, editValue);
                      setEditing(null);
                    }
                    if (event.key === "Escape") {
                      setEditing(null);
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="hover:bg-muted/60 focus-visible:ring-ring h-8 min-w-0 flex-1 truncate rounded-md px-2 text-left text-sm focus-visible:ring-2 focus-visible:outline-none"
                  disabled={!canEdit}
                  onClick={() => {
                    setEditing(lane);
                    setEditValue(lane);
                  }}
                >
                  {lane}
                </button>
              )}
              <Button
                size="icon-sm"
                variant="ghost"
                className="size-8 shrink-0"
                disabled={!canEdit || index === 0}
                aria-label={t("moveLaneUp")}
                title={t("moveLaneUp")}
                onClick={() => onMove(lane, -1)}
              >
                <ChevronUp className="size-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="size-8 shrink-0"
                disabled={!canEdit || index === lanes.length - 1}
                aria-label={t("moveLaneDown")}
                title={t("moveLaneDown")}
                onClick={() => onMove(lane, 1)}
              >
                <ChevronDown className="size-4" />
              </Button>
              {editing === lane ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!canEdit}
                  onClick={() => {
                    onRename(lane, editValue);
                    setEditing(null);
                  }}
                >
                  {t("saveLane")}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                disabled={!canEdit || lanes.length <= 1}
                aria-label={`${t("removeLane")} ${lane}`}
                onClick={() => onRemove(lane)}
              >
                {t("removeLane")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          value={draft}
          disabled={!canEdit}
          placeholder={t("laneNamePlaceholder")}
          aria-label={t("laneNamePlaceholder")}
          className="h-8"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && canEdit) {
              onAdd(draft.trim() || t("lane"));
              setDraft("");
            }
          }}
        />
        <Button
          size="sm"
          disabled={!canEdit}
          onClick={() => {
            onAdd(draft.trim() || t("lane"));
            setDraft("");
          }}
        >
          {t("addLane")}
        </Button>
      </div>
    </div>
  );
}
