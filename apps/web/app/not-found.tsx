import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-poker-dark flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="text-6xl">🃏</div>
        <h1 className="text-2xl font-bold text-poker-gold font-poker">
          Hand Not Found
        </h1>
        <p className="text-gray-400 text-sm">
          This table doesn&apos;t exist. Maybe the AI agents folded it?
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2 rounded-lg bg-poker-gold/20 text-poker-gold border border-poker-gold/30 hover:bg-poker-gold/30 transition-colors text-sm font-semibold"
        >
          ← Back to the Table
        </Link>
      </div>
    </div>
  );
}
