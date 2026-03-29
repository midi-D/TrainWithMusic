interface Props {
  onBack: () => void
}

const VERSION = '0.1.0'

export function AboutScreen({ onBack }: Props) {
  return (
    <div className="h-dvh flex flex-col bg-gray-950">
      {/* Header */}
      <div className="safe-top sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white text-xl font-bold leading-none w-8 h-8 flex items-center justify-center"
          aria-label="Back"
        >←</button>
        <h1 className="text-white font-bold text-lg">About</h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-8 py-12 gap-8 text-center">
        {/* Icon + title */}
        <div className="flex flex-col items-center gap-3">
          <div className="text-6xl">🎵</div>
          <h2 className="text-white text-3xl font-bold tracking-tight">TrainWithMusic</h2>
          <p className="text-gray-400 text-sm">Your personal workout companion</p>
          <span className="text-xs text-gray-600 bg-gray-800 rounded-full px-3 py-1">
            Version {VERSION}
          </span>
        </div>

        <div className="w-full max-w-xs border-t border-gray-800" />

        {/* Author & copyright */}
        <div className="flex flex-col gap-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Author</p>
            <p className="text-white font-medium">Dr. Michael Dinkel</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Copyright</p>
            <p className="text-gray-300">© 2026 Dr. Michael Dinkel</p>
            <p className="text-gray-500 text-xs mt-1">All rights reserved.</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">License</p>
            <p className="text-gray-500 text-xs leading-relaxed">
              For personal use only. Redistribution or commercial use without explicit written permission is not permitted.
            </p>
          </div>
        </div>

        <div className="w-full max-w-xs border-t border-gray-800" />

        <p className="text-gray-700 text-xs">
          Built with React · Web Audio API · Capacitor
        </p>
      </div>
    </div>
  )
}
