import React, { useState } from 'react';
import { Download, Copy, Check, FileText, Code, X } from 'lucide-react';
import { ChatSession } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: ChatSession | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, session }) => {
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  if (!isOpen || !session) return null;

  const getMarkdown = () => {
    let md = `# ${session.title}\n*Exported from Leo AI on ${new Date().toLocaleDateString()}*\n\n---\n\n`;
    for (const m of session.messages) {
      md += `### ${m.role === 'user' ? '👤 You' : '🤖 Leo AI'}\n\n${m.content}\n\n`;
    }
    return md;
  };

  const getJSON = () => {
    return JSON.stringify(session, null, 2);
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string, format: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFormat(format);
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1e1f20] text-[#e3e3e3] rounded-3xl shadow-2xl border border-[#333538] max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#28292c] text-purple-400">
              <Download className="w-4 h-4" />
            </div>
            <h3 className="font-display font-semibold text-base text-white">Export Chat</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8e918f] hover:text-white hover:bg-[#28292c] rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[#8e918f] mb-5">
          Export &ldquo;{session.title}&rdquo; ({session.messages.length} messages) in your preferred format:
        </p>

        <div className="space-y-3">
          {/* Markdown Option */}
          <div className="p-3.5 rounded-2xl border border-[#333538] bg-[#131314] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-xs font-semibold text-white">Markdown (.md)</p>
                <p className="text-[11px] text-[#8e918f]">Formatted with headings and code blocks</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => copyToClipboard(getMarkdown(), 'md')}
                className="p-1.5 text-[#8e918f] hover:text-white rounded-lg hover:bg-[#28292c] transition cursor-pointer"
                title="Copy Markdown"
              >
                {copiedFormat === 'md' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={() => downloadFile(getMarkdown(), `${session.title.slice(0, 20)}.md`, 'text/markdown')}
                className="px-3 py-1.5 bg-white text-black hover:bg-neutral-200 rounded-xl text-xs font-medium transition cursor-pointer"
              >
                Download
              </button>
            </div>
          </div>

          {/* JSON Option */}
          <div className="p-3.5 rounded-2xl border border-[#333538] bg-[#131314] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Code className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-xs font-semibold text-white">Raw JSON (.json)</p>
                <p className="text-[11px] text-[#8e918f]">Full conversation object with timestamps</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => copyToClipboard(getJSON(), 'json')}
                className="p-1.5 text-[#8e918f] hover:text-white rounded-lg hover:bg-[#28292c] transition cursor-pointer"
                title="Copy JSON"
              >
                {copiedFormat === 'json' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={() => downloadFile(getJSON(), `${session.title.slice(0, 20)}.json`, 'application/json')}
                className="px-3 py-1.5 bg-[#28292c] hover:bg-[#333538] text-white border border-[#444746] rounded-xl text-xs font-medium transition cursor-pointer"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
