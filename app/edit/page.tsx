'use client';

import { useState, useEffect } from 'react';
import { ScheduleEditor, ParsedCommand, Diff } from '@/lib/nl-parser';
import Link from 'next/link';

export default function EditPage() {
  const [yamlContent, setYamlContent] = useState<string>('');
  const [command, setCommand] = useState<string>('');
  const [parsed, setParsed] = useState<ParsedCommand | null>(null);
  const [diffs, setDiffs] = useState<Diff[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/schedule?file=schedule_v4.yaml');
      if (!response.ok) throw new Error('Failed to load schedule');
      const content = await response.text();
      setYamlContent(content);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load schedule' });
    } finally {
      setLoading(false);
    }
  };

  const handleParseCommand = async () => {
    if (!command.trim()) return;

    setProcessing(true);
    setParsed(null);
    setDiffs([]);
    setMessage(null);

    try {
      const editor = new ScheduleEditor(yamlContent);
      const result = editor.parseCommand(command);
      const diffList = editor.generateDiff(result);

      setParsed(result);
      setDiffs(diffList);

      if (result.confidence < 0.7) {
        setMessage({
          type: 'error',
          text: `Low confidence (${Math.round(result.confidence * 100)}%). Command not recognized.`
        });
      } else if (result.confidence < 0.95) {
        setMessage({
          type: 'error',
          text: `Medium confidence (${Math.round(result.confidence * 100)}%). Please confirm.`
        });
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to parse command'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleApplyChanges = () => {
    if (!parsed || diffs.length === 0) return;

    try {
      const editor = new ScheduleEditor(yamlContent);
      const updatedYaml = editor.applyDiff(diffs);
      setYamlContent(updatedYaml);
      setMessage({ type: 'success', text: 'Changes applied successfully!' });
      setCommand('');
      setParsed(null);
      setDiffs([]);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to apply changes'
      });
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.95) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Schedule Editor</h1>
            <Link
              href="/"
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Back to Viewer
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Command Input */}
          <div>
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Natural Language Commands</h2>

              <div className="mb-4">
                <input
                  type="text"
                  value={command}
                  onChange={e => setCommand(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleParseCommand()}
                  placeholder="e.g., SW_IMPL is 75%"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={processing}
                />
              </div>

              <button
                onClick={handleParseCommand}
                disabled={processing || !command.trim()}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {processing ? 'Processing...' : 'Parse Command'}
              </button>

              {/* Example commands */}
              <div className="mt-6">
                <h3 className="font-semibold mb-2">Example Commands:</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <div>• <code>SW_IMPL is 75%</code></div>
                  <div>• <code>mark SW_DESIGN complete</code></div>
                  <div>• <code>extend HW_PROTO by 5 days</code></div>
                  <div>• <code>HW_PROTO is at risk: vendor delayed</code></div>
                  <div>• <code>SW_IMPL started 2025-03-28</code></div>
                  <div>• <code>show critical path</code></div>
                </div>
              </div>
            </div>

            {/* Parsed Result */}
            {parsed && (
              <div className="mt-6 bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4">Parsed Command</h2>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-semibold">Intent:</span> {parsed.intent}
                  </div>
                  {parsed.task_id && (
                    <div>
                      <span className="font-semibold">Task:</span> {parsed.task_id}
                      {parsed.task_name && ` (${parsed.task_name})`}
                    </div>
                  )}
                  <div>
                    <span className="font-semibold">Confidence:</span>{' '}
                    <span className={getConfidenceColor(parsed.confidence)}>
                      {Math.round(parsed.confidence * 100)}%
                    </span>
                  </div>
                  {parsed.value !== undefined && (
                    <div>
                      <span className="font-semibold">Value:</span> {parsed.value}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Proposed Changes */}
          <div>
            {diffs.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4">Proposed Changes</h2>

                <div className="space-y-4 mb-6">
                  {diffs.map((diff, i) => (
                    <div key={i} className="border-l-4 border-blue-500 pl-4 py-2">
                      <div className="font-semibold text-sm text-gray-700">
                        {diff.description}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Task: {diff.task_id} • Field: {diff.field}
                      </div>
                      <div className="mt-2 text-sm">
                        <div className="text-red-600">
                          - {JSON.stringify(diff.old_value)}
                        </div>
                        <div className="text-green-600">
                          + {JSON.stringify(diff.new_value)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleApplyChanges}
                  className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  Apply Changes
                </button>
              </div>
            )}

            {/* Messages */}
            {message && (
              <div
                className={`mt-6 rounded-lg p-4 ${
                  message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}
              >
                {message.text}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
