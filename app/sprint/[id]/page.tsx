import React, { Suspense } from "react";
import { ExecutionDesk } from "@/components/sprint/ExecutionDesk";

export default async function SprintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="p-8 bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] font-data text-sm text-[var(--color-ink-secondary)]">
          Loading MagicBlock ER Execution Desk...
        </div>
      }
    >
      <ExecutionDesk sprintId={id} />
    </Suspense>
  );
}
