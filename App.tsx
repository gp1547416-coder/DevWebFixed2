import React, { useState, useEffect, useRef } from 'react';
import { Search, Globe, ArrowRight, Loader2, ExternalLink, BookOpen, Github, Terminal, Cpu, Copy, Check, FileCode } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { performSearch, type SearchResult } from './services/gemini';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PROJECT_FILES = [
  {
    name: 'package.json',
    content: `{
  "name": "devweb",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@google/genai": "^1.29.0",
    "lucide-react": "^0.454.0",
    "motion": "^11.11.11",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-markdown": "^9.0.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3",
    "vite": "^5.4.10"
  }
}`
  },
  {
    name: 'vite.config.ts',
    content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`
  },
  {
    name: 'index.html',
    content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DevWeb Search</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`
  },
  {
    name: 'src/main.tsx',
    content: `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)`
  },
  {
    name: 'src/services/gemini.ts',
    content: `import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

export interface SearchResult {
  text: string;
  sources: { title: string; uri: string }[];
}

export async function performSearch(query: string): Promise<SearchResult> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: "You are DevWeb, a professional search assistant. Provide concise, accurate, and well-structured answers based on Google Search results. Use markdown for formatting. Always cite your sources.",
      },
    });

    const text = response.text || "No results found.";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    const sources = chunks
      .filter(chunk => chunk.web)
      .map(chunk => ({
        title: chunk.web?.title || "Source",
        uri: chunk.web?.uri || "#",
      }));

    const uniqueSources = Array.from(new Map(sources.map(s => [s.uri, s])).values());

    return { text, sources: uniqueSources };
  } catch (error) {
    console.error("Search error:", error);
    throw error;
  }
}`
  },
  {
    name: 'src/index.css',
    content: `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  .markdown-body {
    @apply text-slate-700 leading-relaxed;
  }
  .markdown-body h1 {
    @apply text-2xl font-bold mt-6 mb-4 text-slate-900;
  }
  .markdown-body h2 {
    @apply text-xl font-bold mt-5 mb-3 text-slate-900;
  }
  .markdown-body h3 {
    @apply text-lg font-bold mt-4 mb-2 text-slate-900;
  }
  .markdown-body p {
    @apply mb-4;
  }
  .markdown-body ul {
    @apply list-disc list-inside mb-4 space-y-1;
  }
  .markdown-body ol {
    @apply list-decimal list-inside mb-4 space-y-1;
  }
  .markdown-body code {
    @apply bg-slate-100 px-1.5 py-0.5 rounded font-mono text-sm text-indigo-600;
  }
  .markdown-body pre {
    @apply bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto my-4 text-sm;
  }
  .markdown-body pre code {
    @apply bg-transparent p-0 text-slate-100;
  }
  .markdown-body a {
    @apply text-indigo-600 underline hover:text-indigo-700;
  }
  .markdown-body blockquote {
    @apply border-l-4 border-slate-200 pl-4 italic text-slate-500 my-4;
  }
}`
  }
];

export default function App() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDeployGuide, setShowDeployGuide] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const copyToClipboard = (text: string, fileName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFile(fileName);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || isSearching) return;

    setIsSearching(true);
    setError(null);
    try {
      const data = await performSearch(query);
      setResult(data);
      if (!history.includes(query)) {
        setHistory(prev => [query, ...prev].slice(0, 5));
      }
    } catch (err) {
      setError("Failed to fetch results. Please check your connection or API key.");
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setResult(null); setQuery(''); }}>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Globe className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">DevWeb</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowDeployGuide(true)}
              className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors flex items-center gap-1.5"
            >
              <Terminal className="w-4 h-4" />
              Deploy to Vercel
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-4">
        <AnimatePresence mode="wait">
          {!result ? (
            /* Landing View */
            <motion.div 
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto text-center"
            >
              <h1 className="text-5xl font-bold tracking-tight text-slate-900 mb-6">
                Search the <span className="text-indigo-600">Future</span> of Web
              </h1>
              <p className="text-lg text-slate-600 mb-10 leading-relaxed">
                DevWeb combines the power of Gemini AI with real-time Google Search to give you accurate, cited answers for your development queries.
              </p>

              <form onSubmit={handleSearch} className="relative group">
                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                  <Search className="w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask anything about web development..."
                  className="w-full pl-14 pr-32 py-5 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-lg"
                />
                <button
                  type="submit"
                  disabled={isSearching || !query.trim()}
                  className="absolute right-3 top-3 bottom-3 px-6 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
                </button>
              </form>

              {history.length > 0 && (
                <div className="mt-8 flex flex-wrap justify-center gap-2">
                  {history.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => { setQuery(h); handleSearch(); }}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-sm text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-all"
                    >
                      {h}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                <FeatureCard 
                  icon={<Cpu className="w-5 h-5" />}
                  title="AI Powered"
                  desc="Leveraging Gemini 3 Flash for lightning fast reasoning."
                />
                <FeatureCard 
                  icon={<Globe className="w-5 h-5" />}
                  title="Real-time Data"
                  desc="Grounded in Google Search for the most up-to-date info."
                />
                <FeatureCard 
                  icon={<BookOpen className="w-5 h-5" />}
                  title="Cited Sources"
                  desc="Every answer comes with verifiable links to documentation."
                />
              </div>
            </motion.div>
          ) : (
            /* Results View */
            <motion.div 
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-4xl mx-auto"
            >
              <div className="flex flex-col md:flex-row gap-8">
                {/* Main Content */}
                <div className="flex-1 min-w-0">
                  <div className="mb-8 flex items-center gap-4">
                    <form onSubmit={handleSearch} className="flex-1 relative">
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </form>
                  </div>

                  {isSearching ? (
                    <div className="space-y-4">
                      <div className="h-4 bg-slate-200 rounded w-3/4 animate-pulse" />
                      <div className="h-4 bg-slate-200 rounded w-full animate-pulse" />
                      <div className="h-4 bg-slate-200 rounded w-5/6 animate-pulse" />
                    </div>
                  ) : (
                    <div className="prose prose-slate max-w-none">
                      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm markdown-body">
                        <Markdown>
                          {result.text}
                        </Markdown>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sidebar / Sources */}
                <div className="w-full md:w-72 shrink-0">
                  <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Sources
                  </h3>
                  <div className="space-y-3">
                    {result.sources.length > 0 ? (
                      result.sources.map((source, i) => (
                        <a
                          key={i}
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all group"
                        >
                          <div className="text-sm font-medium text-slate-800 line-clamp-1 group-hover:text-indigo-600">
                            {source.title}
                          </div>
                          <div className="text-xs text-slate-400 truncate mt-1">
                            {source.uri}
                          </div>
                        </a>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500 italic">No direct sources cited.</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Deployment Guide Modal */}
      <AnimatePresence>
        {showDeployGuide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeployGuide(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Terminal className="w-6 h-6 text-indigo-600" />
                    Deployment & Files
                  </h2>
                  <button onClick={() => setShowDeployGuide(false)} className="text-slate-400 hover:text-slate-600">
                    <ArrowRight className="w-6 h-6 rotate-45" />
                  </button>
                </div>

                <div className="space-y-8 text-slate-600">
                  <section className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                    <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                      📱 Tablet / Mobile Instructions
                    </h3>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Since you're on a tablet, you can't "download" a ZIP easily. Instead, <strong>copy the code for each file below</strong> and create them directly in your GitHub repository using their web editor.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <FileCode className="w-5 h-5 text-indigo-600" />
                      Project Files
                    </h3>
                    <div className="space-y-4">
                      {PROJECT_FILES.map((file) => (
                        <div key={file.name} className="border border-slate-200 rounded-xl overflow-hidden">
                          <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-mono font-medium text-slate-600">{file.name}</span>
                            <button 
                              onClick={() => copyToClipboard(file.content, file.name)}
                              className="p-1.5 hover:bg-slate-200 rounded-md transition-colors text-slate-500"
                              title="Copy code"
                            >
                              {copiedFile === file.name ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>
                          <pre className="p-4 bg-slate-900 text-slate-300 text-[10px] font-mono overflow-x-auto leading-relaxed max-h-48">
                            {file.content}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Next Steps</h3>
                    <ul className="list-decimal list-inside text-sm space-y-2">
                      <li>Go to <a href="https://github.com/new" target="_blank" className="text-indigo-600 underline">GitHub.com/new</a></li>
                      <li>Create a repo named <code className="bg-slate-100 px-1 rounded">devweb</code></li>
                      <li>Tap "Create new file" for each file above</li>
                      <li>Paste the code and commit</li>
                      <li>Deploy the repo on <a href="https://vercel.com" target="_blank" className="text-indigo-600 underline">Vercel</a></li>
                    </ul>
                  </section>
                </div>
              </div>
              <div className="bg-slate-50 p-4 flex justify-end border-t border-slate-200">
                <button 
                  onClick={() => setShowDeployGuide(false)}
                  className="px-6 py-2 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="p-6 bg-white border border-slate-200 rounded-2xl hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5 transition-all">
      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
    </div>
  );
}
