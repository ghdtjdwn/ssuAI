"use client";

import { useState } from "react";

import { BriefingHero } from "./BriefingHero";
import { HomeEditor } from "./HomeEditor";
import { PriorityCards } from "./PriorityCards";
import { useHomeLayout } from "./useHomeLayout";
import { WidgetGrid } from "./WidgetGrid";

/**
 * Home (오늘) screen: AI briefing hero → priority cards → customizable
 * widget grid. App chrome (sidebar/topbar/tabs) comes from AppShell.
 */
export function HomeView() {
  const controller = useHomeLayout();
  const [editorOpen, setEditorOpen] = useState(false);

  return (
    <div className="pb-4">
      {controller.layout.briefingOn ? (
        <div className="mb-3.5">
          <BriefingHero />
        </div>
      ) : null}
      <PriorityCards />
      <WidgetGrid controller={controller} onOpenEditor={() => setEditorOpen(true)} />
      <HomeEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        controller={controller}
      />
    </div>
  );
}
