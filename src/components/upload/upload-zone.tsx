"use client";

import { useDropzone } from "react-dropzone";
import { UploadCloud, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  accept?: Record<string, string[]>;
  title?: string;
  subtitle?: string;
  className?: string;
}

export function UploadZone({
  onFiles,
  multiple = false,
  accept = { "image/*": [] },
  title = "Tarik foto ke sini",
  subtitle = "atau klik untuk pilih file",
  className,
}: UploadZoneProps) {
  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop: onFiles,
      multiple,
      accept,
    });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "group relative cursor-pointer rounded-2xl border-2 border-dashed transition-all p-8 sm:p-12 text-center",
        isDragActive
          ? "border-neon-cyan bg-neon-cyan/5 glow-cyan"
          : "border-border/60 bg-card/40 hover:border-neon-cyan/60 hover:bg-card/60",
        className,
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3 pointer-events-none">
        <div
          className={cn(
            "relative h-14 w-14 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
            isDragActive
              ? "neon-gradient text-background"
              : "bg-secondary text-neon-cyan",
          )}
        >
          {isDragActive ? (
            <ImageIcon className="h-7 w-7" />
          ) : (
            <UploadCloud className="h-7 w-7" />
          )}
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-sm sm:text-base">
            {isDragActive ? "Lepaskan di sini!" : title}
          </p>
          <p className="text-xs text-muted-foreground">
            {isDragReject
              ? "Format file tidak didukung"
              : subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}
