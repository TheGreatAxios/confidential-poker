interface FooterProps {
  compact?: boolean;
}

export function Footer({ compact = false }: FooterProps) {
  return (
    <footer className={`w-full border-t border-gray-800/50 bg-poker-darker/50 ${compact ? "py-2" : "py-4"}`}>
      <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <span>Built by Sawyer Cutler, VP Developer Success at SKALE</span>
        </div>
      </div>
    </footer>
  );
}
