"use client";

import { useState } from "react";
import { Header, type TabId, TABS } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { PhotoPrinter } from "@/components/print/photo-printer";
import { PolaroidMaker } from "@/components/print/polaroid-maker";
import { PhotoEditor } from "@/components/print/photo-editor";
import { DocumentPrinter } from "@/components/print/document-printer";

export default function Home() {
  const [tab, setTab] = useState<TabId>("photo");

  const activeTab = TABS.find((t) => t.id === tab);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header active={tab} onChange={setTab} />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6">
        <div className="mb-6 no-print">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {activeTab?.label}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeTab?.desc}
          </p>
        </div>

        {tab === "photo" && <PhotoPrinter />}
        {tab === "polaroid" && <PolaroidMaker />}
        {tab === "editor" && <PhotoEditor />}
        {tab === "document" && <DocumentPrinter />}
      </main>

      <Footer />
    </div>
  );
}
