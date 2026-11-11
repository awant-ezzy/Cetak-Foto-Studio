"use client";

import { ImageIcon, Sparkles, FileText, Printer } from "lucide-react";

export type TabId = "photo" | "polaroid" | "editor" | "document";

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
}

export const TABS: TabDef[] = [
  {
    id: "photo",
    label: "Cetak Foto",
    icon: ImageIcon,
    desc: "Cetak berbagai ukuran di satu lembar",
  },
  {
    id: "polaroid",
    label: "Polaroid",
    icon: Sparkles,
    desc: "Polaroid klasik putih",
  },
  {
    id: "editor",
    label: "Editor Foto",
    icon: Printer,
    desc: "Edit, HD enhance, beauty retouch",
  },
  {
    id: "document",
    label: "Cetak Dokumen",
    icon: FileText,
    desc: "Cetak PDF/JPG langsung",
  },
];

interface HeaderProps {
  active: TabId;
  onChange: (id: TabId) => void;
}

export function Header({ active, onChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 rounded-lg neon-gradient flex items-center justify-center glow-cyan">
              <Printer className="h-5 w-5 text-background" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-bold tracking-tight">
                CetakFoto{" "}
                <span className="neon-gradient-text">Studio</span>
              </span>
              <span className="text-[10px] text-muted-foreground hidden sm:block">
                Pro Studio · A5–A3 · HD Output
              </span>
            </div>
          </div>

          {/* Tabs */}
          <nav
            className="flex items-center gap-1 p-1 rounded-xl bg-card/60 border border-border/60 overflow-x-auto scrollbar-studio max-w-full"
            aria-label="Navigasi Fitur"
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = active === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onChange(tab.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-primary text-primary-foreground glow-cyan"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
