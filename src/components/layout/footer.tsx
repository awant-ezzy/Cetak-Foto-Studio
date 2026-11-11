"use client";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-background/60 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="neon-gradient-text font-semibold">
              CetakFoto Studio
            </span>
            <span>·</span>
            <span>Cetak profesional langsung dari browser</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Output: PDF · Print Langsung · A5/A4/A3</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">300 DPI HD</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
