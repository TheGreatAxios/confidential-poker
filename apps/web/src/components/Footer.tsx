interface FooterProps {
  compact?: boolean;
}

export function Footer({ compact = false }: FooterProps) {
  if (compact) {
    return (
      <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.03] bg-poker-void/60 py-1.5 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-center px-4">
          <span className="text-[10px] text-gray-600">
            Built by Sawyer Cutler, VP Developer Success at SKALE
          </span>
        </div>
      </footer>
    );
  }

  return (
    <footer className="w-full border-t border-gray-800/50 bg-poker-darker/50 py-4">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-xs text-gray-600 sm:flex-row">
        <div className="flex items-center gap-2">
          <span>Built by Sawyer Cutler, VP Developer Success at SKALE</span>
        </div>
      </div>
    </footer>
  );
}
