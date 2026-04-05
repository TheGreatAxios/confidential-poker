export function Footer() {
  return (
    <footer className="w-full border-t border-gray-800/50 bg-poker-darker/50 py-4">
      <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <span>🃏 AI Poker Night</span>
          <span>•</span>
          <span>Confidential Texas Hold&apos;em</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Built with Next.js + Hono + Foundry</span>
          <span>•</span>
          <span className="text-poker-gold/60">Powered by AI Decision Engines</span>
        </div>
      </div>
    </footer>
  );
}
