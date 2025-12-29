'use client';

interface CanvasViewSetupGuideProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueAnyway: () => void;
  mainDatabaseName?: string;
}

export default function CanvasViewSetupGuide({
  isOpen,
  onClose,
  onContinueAnyway,
  mainDatabaseName = 'your main database',
}: CanvasViewSetupGuideProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💾</span>
            <h2 className="text-xl font-bold text-white">Setup Canvas View Database</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Introduction */}
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-purple-400 text-xl">💡</span>
              <div>
                <p className="text-purple-300 font-medium">Why do I need this?</p>
                <p className="text-purple-300/70 text-sm mt-1">
                  To save and sync your canvas views across devices, we need a separate Notion database to store view configurations. This is optional - views will still be saved locally in your browser.
                </p>
              </div>
            </div>
          </div>

          {/* Step 1: Create Database */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white flex items-center justify-center font-bold flex-shrink-0">
                1
              </div>
              <h3 className="text-lg font-semibold text-white">Create a Canvas View Database</h3>
            </div>

            <div className="ml-11 space-y-3">
              <p className="text-gray-400 text-sm">
                In Notion, create a new database called <span className="text-white font-medium">&quot;Canvas Views&quot;</span> with these properties:
              </p>

              <div className="bg-gray-700/50 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <span className="w-6 h-6 rounded bg-purple-500/20 flex items-center justify-center text-purple-400">T</span>
                  <span className="text-white font-medium">View Name</span>
                  <span className="text-gray-500">(Title property - auto-created)</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center text-blue-400">Aa</span>
                  <span className="text-white font-medium">viewport_x</span>
                  <span className="text-gray-500">(Text property)</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center text-blue-400">Aa</span>
                  <span className="text-white font-medium">viewport_y</span>
                  <span className="text-gray-500">(Text property)</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center text-blue-400">Aa</span>
                  <span className="text-white font-medium">viewport_zoom</span>
                  <span className="text-gray-500">(Text property)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Add Relation Property */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white flex items-center justify-center font-bold flex-shrink-0">
                2
              </div>
              <h3 className="text-lg font-semibold text-white">Add Relation to Your Main Database</h3>
            </div>

            <div className="ml-11 space-y-3">
              <p className="text-gray-400 text-sm">
                Add a <span className="text-white font-medium">Relation</span> property that links to <span className="text-purple-400">{mainDatabaseName}</span>:
              </p>

              <div className="bg-gray-700/50 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">a</div>
                  <div>
                    <p className="text-white text-sm">Click <span className="font-medium">+ Add a property</span></p>
                    <p className="text-gray-500 text-xs">In your Canvas Views database</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">b</div>
                  <div>
                    <p className="text-white text-sm">Select <span className="font-medium">Relation</span> type</p>
                    <p className="text-gray-500 text-xs">This creates a link between databases</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">c</div>
                  <div>
                    <p className="text-white text-sm">Choose <span className="text-purple-400">{mainDatabaseName}</span></p>
                    <p className="text-gray-500 text-xs">Select your main task/item database</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">d</div>
                  <div>
                    <p className="text-white text-sm">Name it <span className="font-medium text-green-400">&quot;Items&quot;</span></p>
                    <p className="text-gray-500 text-xs">This will store which items are in each view</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Share with Integration */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white flex items-center justify-center font-bold flex-shrink-0">
                3
              </div>
              <h3 className="text-lg font-semibold text-white">Share with Your Integration</h3>
            </div>

            <div className="ml-11 space-y-3">
              <p className="text-gray-400 text-sm">
                Don&apos;t forget to connect your Canvas Views database to your Notion integration:
              </p>

              <div className="bg-gray-700/50 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-yellow-400">⚠️</span>
                  <p className="text-gray-300 text-sm">
                    Click the <span className="font-medium">...</span> menu in your Canvas Views database, go to <span className="font-medium">Connections</span>, and add your integration (the same one you used for your main database).
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4: Get Database ID */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white flex items-center justify-center font-bold flex-shrink-0">
                4
              </div>
              <h3 className="text-lg font-semibold text-white">Copy the Database ID</h3>
            </div>

            <div className="ml-11 space-y-3">
              <p className="text-gray-400 text-sm">
                Copy the Canvas Views database URL. The database ID is the 32-character string after your workspace name:
              </p>

              <div className="bg-gray-900 rounded-xl p-4 font-mono text-xs overflow-x-auto">
                <p className="text-gray-400 mb-1">Example URL:</p>
                <p className="text-white break-all">
                  notion.so/workspace/<span className="text-purple-400 bg-purple-500/20 px-1 rounded">abc123def456...</span>?v=...
                </p>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
                <p className="text-blue-300 text-sm">
                  <span className="font-medium">Coming soon:</span> Automatic Canvas View database detection! For now, views are saved to Notion using your main database&apos;s integration.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 px-6 py-4 flex items-center justify-between gap-4">
          <button
            onClick={onContinueAnyway}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            Skip for now (save locally)
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all transform hover:scale-[1.02]"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}
