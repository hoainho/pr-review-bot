import React from 'react';
import {
  Code2, ArrowLeft, Zap, Shield, GitBranch, Brain, Layers,
  CheckCircle2, Rocket, FileCode, MessageSquare, Clock,
  TrendingUp, Sparkles, AlertTriangle, Package,
  RefreshCw, Eye, Keyboard
} from 'lucide-react';

interface DocumentationPageProps {
  onBack: () => void;
}

export const DocumentationPage: React.FC<DocumentationPageProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800">
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back to App</span>
          </button>
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-black text-white">Documentation</span>
          </div>
          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/30 mb-6">
            <Sparkles className="w-4 h-4 text-indigo-400 mr-2" />
            <span className="text-sm font-bold text-indigo-400">Version 2.0 — Multi-AI Engine</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
            Gear PR Review
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Enterprise-grade AI code review platform with intelligent model rotation, 
            deep context analysis, and seamless GitHub integration.
          </p>
        </div>

        <nav className="bg-slate-800/50 rounded-2xl p-6 mb-12 border border-slate-700/50">
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4">Quick Navigation</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Getting Started', href: '#getting-started' },
              { label: 'AI Models', href: '#ai-models' },
              { label: 'Features', href: '#features' },
              { label: 'Keyboard Shortcuts', href: '#shortcuts' },
              { label: 'Release Notes', href: '#releases' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition-colors text-center"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        <section id="getting-started" className="mb-16">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Rocket className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-black text-white">Getting Started</h2>
          </div>
          
          <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50">
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm shrink-0">1</div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Sign In with Google</h3>
                  <p className="text-slate-400">Authenticate securely using your Google account. We only request basic profile information for identification.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm shrink-0">2</div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Enter GitHub PR URL</h3>
                  <p className="text-slate-400">Paste any GitHub pull request URL. Both public and private repositories are supported (with appropriate token).</p>
                  <code className="mt-2 block bg-slate-900 rounded-lg p-3 text-sm text-indigo-400 font-mono">
                    https://github.com/owner/repo/pull/123
                  </code>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm shrink-0">3</div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Configure & Analyze</h3>
                  <p className="text-slate-400">Enable optional features like GitHub Context, Jira Integration, or React/TypeScript analyzers. Click "Analyze PR" to start.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm shrink-0">✓</div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Review & Post</h3>
                  <p className="text-slate-400">Review AI findings, approve or reject suggestions, then post approved comments directly to GitHub.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="ai-models" className="mb-16">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-2xl font-black text-white">Multi-AI Engine</h2>
          </div>
          
          <p className="text-slate-400 mb-6">
            Gear PR Review uses an intelligent model rotation system that automatically selects the best available AI model. 
            If one model hits rate limits or fails, the system seamlessly switches to the next available model.
          </p>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-2xl p-6 border border-indigo-500/30">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <span className="text-lg font-black text-indigo-400">C</span>
                </div>
                <div>
                  <h3 className="font-bold text-white">Claude</h3>
                  <p className="text-xs text-slate-400">by Anthropic</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />Claude Opus 4.5 Thinking</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />Claude Sonnet 4.5</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />Claude Sonnet 4.5 Thinking</li>
              </ul>
              <div className="mt-4 pt-4 border-t border-indigo-500/20">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Priority: Highest</span>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-2xl p-6 border border-emerald-500/30">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <span className="text-lg font-black text-emerald-400">G</span>
                </div>
                <div>
                  <h3 className="font-bold text-white">GPT</h3>
                  <p className="text-xs text-slate-400">by OpenAI</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />GPT-5.2 Codex</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />GPT-5.1 Codex Max</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />GPT-5.2 / 5.1</li>
              </ul>
              <div className="mt-4 pt-4 border-t border-emerald-500/20">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Priority: High</span>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl p-6 border border-blue-500/30">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <span className="text-lg font-black text-blue-400">G</span>
                </div>
                <div>
                  <h3 className="font-bold text-white">Gemini</h3>
                  <p className="text-xs text-slate-400">by Google</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />Gemini 3 Pro</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />Gemini 2.5 Pro</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />Gemini 3/2.5 Flash</li>
              </ul>
              <div className="mt-4 pt-4 border-t border-blue-500/20">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Priority: Medium</span>
              </div>
            </div>
          </div>
          
          <div className="mt-6 bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-start space-x-3">
              <RefreshCw className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-white mb-1">Automatic Failover</h4>
                <p className="text-sm text-slate-400">
                  If a model returns an error or hits rate limits, the system automatically retries with the next available model. 
                  Up to 10 retry attempts across all available models ensure your analysis completes successfully.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mb-16">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="text-2xl font-black text-white">Features</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <FeatureCard
              icon={<Eye className="w-5 h-5" />}
              title="Deep Code Analysis"
              description="Detects race conditions, memory leaks, security vulnerabilities, state management bugs, and more with detailed explanations."
              color="indigo"
            />
            <FeatureCard
              icon={<GitBranch className="w-5 h-5" />}
              title="GitHub Integration"
              description="Fetch repository context including file structure, component relationships, constants, and type definitions for smarter analysis."
              color="emerald"
            />
            <FeatureCard
              icon={<Layers className="w-5 h-5" />}
              title="React Best Practices"
              description="Specialized analyzer for React apps: detects unnecessary re-renders, waterfall requests, bundle size issues, and anti-patterns."
              color="cyan"
            />
            <FeatureCard
              icon={<FileCode className="w-5 h-5" />}
              title="TypeScript Analyzer"
              description="29 rules across 7 categories: type safety, null safety, generics, enums, strict mode, imports, and patterns."
              color="blue"
            />
            <FeatureCard
              icon={<TrendingUp className="w-5 h-5" />}
              title="Performance Analysis"
              description="Identifies O(n²) algorithms, blocking operations, memory bloat, and suggests modern JS/TS optimizations."
              color="amber"
            />
            <FeatureCard
              icon={<AlertTriangle className="w-5 h-5" />}
              title="Breaking Change Detection"
              description="Automatically detects API removals, type changes, signature modifications, and behavioral changes with SemVer impact."
              color="red"
            />
            <FeatureCard
              icon={<Package className="w-5 h-5" />}
              title="Code Duplication"
              description="Identifies similar code patterns across files and suggests extraction into reusable functions or components."
              color="purple"
            />
            <FeatureCard
              icon={<MessageSquare className="w-5 h-5" />}
              title="Jira/Confluence Integration"
              description="Auto-discovers linked tickets and documentation to provide PRD/TDD context for requirement-aware reviews."
              color="teal"
            />
          </div>
        </section>



        <section id="shortcuts" className="mb-16">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-pink-500/20 rounded-lg">
              <Keyboard className="w-5 h-5 text-pink-400" />
            </div>
            <h2 className="text-2xl font-black text-white">Keyboard Shortcuts</h2>
          </div>
          
          <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50">
            <div className="grid md:grid-cols-2 gap-4">
              <ShortcutRow keys={['⌘', '⇧', 'D']} description="Toggle dark/light theme" />
              <ShortcutRow keys={['⌘', 'E']} description="Export review results" />
              <ShortcutRow keys={['⌘', '⇧', 'A']} description="Approve all pending issues" />
              <ShortcutRow keys={['⌘', '⇧', 'R']} description="Reject all pending issues" />
              <ShortcutRow keys={['⌘', '/']} description="Show keyboard shortcuts" />
              <ShortcutRow keys={['Esc']} description="Close modals/dialogs" />
            </div>
          </div>
        </section>

        <section id="releases" className="mb-16">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-black text-white">Release Notes</h2>
          </div>
          
          <div className="space-y-6">
            <ReleaseNote
              version="2.0.0"
              date="February 2025"
              type="major"
              changes={[
                'Multi-AI Engine: Support for Claude, GPT, and Gemini models with automatic failover',
                'TypeScript Best Practices: 29 rules across 7 categories for comprehensive TS analysis',
                'Model Rotation: Intelligent priority-based model selection with quota management',
                'React Analyzer: Specialized detection for React-specific performance issues',
                'Breaking Change Detection: Automatic SemVer impact analysis',
                'Code Duplication: Cross-file pattern detection with extraction suggestions',
              ]}
            />
            <ReleaseNote
              version="1.5.0"
              date="January 2025"
              type="minor"
              changes={[
                'Jira/Confluence Integration: Auto-discover linked tickets from PR',
                'Large PR Support: Handle 300+ file PRs with pagination',
                'Review History: Track past reviews with full detail view',
                'Export Options: Markdown, JSON, and HTML export formats',
              ]}
            />
            <ReleaseNote
              version="1.0.0"
              date="December 2024"
              type="major"
              changes={[
                'Initial release with Gemini Pro integration',
                'GitHub PR analysis and comment posting',
                'Deep context analysis with repository structure',
                'Google OAuth authentication',
              ]}
            />
          </div>
        </section>

        <section className="text-center py-12 border-t border-slate-800">
          <h2 className="text-2xl font-black text-white mb-4">Need Help?</h2>
          <p className="text-slate-400 mb-6">
            Check out our support resources or reach out to the team.
          </p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={onBack}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors"
            >
              Back to App
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

const FeatureCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}> = ({ icon, title, description, color }) => {
  const colorClasses: Record<string, string> = {
    indigo: 'from-indigo-500/10 to-indigo-600/5 border-indigo-500/30 text-indigo-400',
    emerald: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/30 text-emerald-400',
    cyan: 'from-cyan-500/10 to-cyan-600/5 border-cyan-500/30 text-cyan-400',
    blue: 'from-blue-500/10 to-blue-600/5 border-blue-500/30 text-blue-400',
    amber: 'from-amber-500/10 to-amber-600/5 border-amber-500/30 text-amber-400',
    red: 'from-red-500/10 to-red-600/5 border-red-500/30 text-red-400',
    purple: 'from-purple-500/10 to-purple-600/5 border-purple-500/30 text-purple-400',
    teal: 'from-teal-500/10 to-teal-600/5 border-teal-500/30 text-teal-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-6 border`}>
      <div className={`w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center mb-4 ${colorClasses[color].split(' ').pop()}`}>
        {icon}
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  );
};

const ShortcutRow: React.FC<{ keys: string[]; description: string }> = ({ keys, description }) => (
  <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
    <span className="text-slate-300">{description}</span>
    <div className="flex space-x-1">
      {keys.map((key, i) => (
        <kbd key={i} className="px-2 py-1 bg-slate-700 rounded text-xs font-mono text-slate-300">
          {key}
        </kbd>
      ))}
    </div>
  </div>
);

const ReleaseNote: React.FC<{
  version: string;
  date: string;
  type: 'major' | 'minor' | 'patch';
  changes: string[];
}> = ({ version, date, type, changes }) => {
  const typeColors = {
    major: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    minor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    patch: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };

  return (
    <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <span className="text-xl font-black text-white">v{version}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${typeColors[type]}`}>
            {type}
          </span>
        </div>
        <span className="text-sm text-slate-500">{date}</span>
      </div>
      <ul className="space-y-2">
        {changes.map((change, i) => (
          <li key={i} className="flex items-start space-x-2 text-sm text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{change}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DocumentationPage;
