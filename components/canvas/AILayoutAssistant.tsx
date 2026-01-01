'use client';

import { useState, useEffect, useRef } from 'react';

interface CanvasItem {
  id: string;
  title: string;
  properties: Record<string, any>;
  currentPosition?: { x: number; y: number };
}

interface LayoutItem {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
  reasoning?: string;
}

interface LayoutOption {
  name: string;
  description: string;
  items: LayoutItem[];
}

interface AILayoutAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  items: CanvasItem[];
  schema: Array<{ name: string; type: string }>;
  canvasSize: { width: number; height: number };
  onApplyLayout: (layout: LayoutItem[]) => void;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  layout?: LayoutOption;
  isLoading?: boolean;
}

export default function AILayoutAssistant({
  isOpen,
  onClose,
  items,
  schema,
  canvasSize,
  onApplyLayout,
}: AILayoutAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get layout-relevant properties (exclude internal/system properties)
  const relevantProperties = schema.filter(
    (prop) =>
      !prop.name.startsWith('canvas_') &&
      !prop.name.includes('_id') &&
      prop.type !== 'formula' &&
      prop.type !== 'rollup' &&
      prop.type !== 'button' &&
      prop.type !== 'files'
  );

  // Initialize with welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const propertyNames = relevantProperties.map((p) => p.name).slice(0, 5);
      setMessages([
        {
          role: 'assistant',
          content: `Hi! I can help you arrange your ${items.length} items on the canvas.

I see properties like: **${propertyNames.join(', ')}**${relevantProperties.length > 5 ? ` and ${relevantProperties.length - 5} more` : ''}.

Tell me how you'd like to organize them! For example:
- "Arrange by deadline with urgent ones at the top"
- "Group by status"
- "Create a priority matrix"
- "Spread items in a circle"`,
        },
      ]);
    }
  }, [isOpen, items.length, relevantProperties.length]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');

    // Add user message
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);

    // Add loading message
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: 'Thinking...', isLoading: true },
    ]);
    setIsLoading(true);

    try {
      // Prepare items for the API
      const preparedItems = items.map((item) => ({
        id: item.id,
        title: item.properties['Task Plan'] || item.properties['Name'] || item.properties['title'] || 'Untitled',
        properties: item.properties,
        currentPosition: item.currentPosition,
      }));

      const response = await fetch('/api/ai-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: preparedItems,
          canvasSize,
          userRequest: userMessage,
          selectedProperties: selectedProperties.length > 0 ? selectedProperties : relevantProperties.map((p) => p.name),
        }),
      });

      const result = await response.json();

      // Remove loading message
      setMessages((prev) => prev.filter((m) => !m.isLoading));

      if (result.error) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Sorry, I encountered an error: ${result.error}`,
          },
        ]);
      } else if (result.layouts && result.layouts.length > 0) {
        const layout = result.layouts[0];
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `**${layout.name}**

${layout.description}

${result.insights ? `\n*Insight: ${result.insights}*` : ''}`,
            layout,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: "I couldn't generate a layout. Please try rephrasing your request.",
          },
        ]);
      }
    } catch (error: any) {
      // Remove loading message
      setMessages((prev) => prev.filter((m) => !m.isLoading));
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, something went wrong: ${error.message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyLayout = (layout: LayoutOption) => {
    onApplyLayout(layout.items);
    setMessages((prev) => [
      ...prev,
      {
        role: 'system',
        content: `Layout "${layout.name}" applied to canvas!`,
      },
    ]);
  };

  const toggleProperty = (propName: string) => {
    setSelectedProperties((prev) =>
      prev.includes(propName)
        ? prev.filter((p) => p !== propName)
        : [...prev, propName]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-gray-900 border-l border-gray-700 shadow-xl flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-purple-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
            />
          </svg>
          <h2 className="text-lg font-semibold text-white">AI Layout Assistant</h2>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Property Filter (Collapsible) */}
      <details className="border-b border-gray-700">
        <summary className="px-4 py-2 text-sm text-gray-400 cursor-pointer hover:bg-gray-800">
          Filter Properties ({selectedProperties.length || 'All'})
        </summary>
        <div className="px-4 pb-3 flex flex-wrap gap-2 max-h-32 overflow-y-auto">
          {relevantProperties.map((prop) => (
            <button
              key={prop.name}
              onClick={() => toggleProperty(prop.name)}
              className={`px-2 py-1 text-xs rounded-full transition-colors ${
                selectedProperties.includes(prop.name) || selectedProperties.length === 0
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {prop.name}
            </button>
          ))}
        </div>
      </details>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`${
              message.role === 'user'
                ? 'ml-8'
                : message.role === 'system'
                ? 'mx-4'
                : 'mr-8'
            }`}
          >
            <div
              className={`p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-purple-600 text-white'
                  : message.role === 'system'
                  ? 'bg-green-900/50 text-green-300 text-center text-sm'
                  : 'bg-gray-800 text-gray-200'
              } ${message.isLoading ? 'animate-pulse' : ''}`}
            >
              {/* Render markdown-like content */}
              <div className="whitespace-pre-wrap">
                {message.content.split('\n').map((line, i) => (
                  <p key={i} className={line.startsWith('**') ? 'font-bold' : ''}>
                    {line.replace(/\*\*/g, '')}
                  </p>
                ))}
              </div>
            </div>

            {/* Apply Layout Button */}
            {message.layout && (
              <button
                onClick={() => handleApplyLayout(message.layout!)}
                className="mt-2 w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Apply This Layout
              </button>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Describe how to arrange items..."
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500 text-center">
          Powered by Gemini AI
        </p>
      </div>
    </div>
  );
}
