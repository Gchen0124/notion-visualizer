'use client';

interface PrivacyNoticeProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export default function PrivacyNotice({ variant = 'compact', className = '' }: PrivacyNoticeProps) {
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 text-xs text-gray-400 ${className}`}>
        <svg
          className="w-4 h-4 text-green-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
        <span>Your data stays in your browser. We don't store anything.</span>
      </div>
    );
  }

  return (
    <div className={`p-4 bg-green-900/20 border border-green-700/50 rounded-lg ${className}`}>
      <div className="flex items-start gap-3">
        <svg
          className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
        <div>
          <h3 className="font-semibold text-green-300 mb-2">Your Data Stays Yours</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            <li className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              Credentials stored only in your browser
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              No database on our end - zero data collection
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              API calls go directly to Notion
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              Clear browser data = disconnect app
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              Revoke access anytime in Notion settings
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
