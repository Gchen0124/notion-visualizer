'use client';

interface DemoModeBannerProps {
  onConnectClick: () => void;
  onDismiss: () => void;
}

export default function DemoModeBanner({ onConnectClick, onDismiss }: DemoModeBannerProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-xl flex-shrink-0">🎮</span>
          <p className="text-sm font-medium truncate">
            <span className="hidden sm:inline">You&apos;re viewing a </span>
            <span className="font-bold">Demo</span>
            <span className="hidden md:inline"> - Connect your own Notion database to save your work</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onConnectClick}
            className="px-4 py-1.5 bg-white text-purple-600 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
          >
            Connect
          </button>
          <button
            onClick={onDismiss}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Dismiss banner"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
