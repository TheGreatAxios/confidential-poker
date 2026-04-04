export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 animate-fadeIn">
        <div
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-poker-gold/20 to-poker-gold/5 flex items-center justify-center animate-pulse"
        >
          <span className="text-3xl">🃏</span>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-400">Loading table...</p>
          <p className="text-xs text-gray-600 mt-1">Shuffling the deck</p>
        </div>
      </div>
    </div>
  );
}
