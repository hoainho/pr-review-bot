import React from 'react';
import {
  Code2, ArrowLeft, Shield, Lock, Eye, EyeOff, Server, Database,
  Key, CheckCircle2, XCircle, AlertTriangle, Globe, Fingerprint,
  FileKey, Trash2, Clock, RefreshCw, ShieldCheck, ShieldAlert,
  Zap, Users, Building, Heart
} from 'lucide-react';

interface SecurityPageProps {
  onBack: () => void;
}

export const SecurityPage: React.FC<SecurityPageProps> = ({ onBack }) => {
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
            <div className="bg-emerald-600 p-2 rounded-xl">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-black text-white">Security</span>
          </div>
          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/30 mb-6">
            <ShieldCheck className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
            Your Security is Our Priority
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            We've built Gear PR Review with a zero-trust architecture. Your code stays yours — 
            we never store, log, or retain any of your sensitive information.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <TrustCard
            icon={<EyeOff className="w-6 h-6" />}
            title="Zero Data Retention"
            description="Your code is processed in real-time and immediately discarded. We never store diffs, reviews, or any code content."
            color="emerald"
          />
          <TrustCard
            icon={<Lock className="w-6 h-6" />}
            title="Client-Side Keys"
            description="API keys and tokens are stored only in your browser. They're never sent to or stored on our servers."
            color="blue"
          />
          <TrustCard
            icon={<Zap className="w-6 h-6" />}
            title="Direct API Calls"
            description="All AI requests go directly from your browser to the AI provider. We're just the interface, not the middleman."
            color="purple"
          />
        </div>

        <section className="mb-16">
          <div className="flex items-center space-x-3 mb-8">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <FileKey className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-black text-white">Our Security Commitments</h2>
          </div>

          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
            <CommitmentRow
              icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              title="No Code Storage"
              description="We do NOT store, log, cache, or retain any of your source code, diffs, or review results. Every analysis is ephemeral."
              positive
            />
            <CommitmentRow
              icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              title="No API Key Storage"
              description="Your GitHub tokens, API keys, and credentials are stored only in your browser's local storage. We have zero access to them."
              positive
            />
            <CommitmentRow
              icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              title="No Analytics on Code"
              description="We don't analyze, aggregate, or use your code for any purpose other than the immediate review you requested."
              positive
            />
            <CommitmentRow
              icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              title="No Third-Party Sharing"
              description="Your code and data are never shared with third parties, advertisers, or used for AI training purposes."
              positive
            />
            <CommitmentRow
              icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              title="Encrypted Connections"
              description="All communications use TLS 1.3 encryption. Data in transit is always protected with industry-standard encryption."
              positive
            />
            <CommitmentRow
              icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              title="Open Source Transparency"
              description="Our codebase is open for inspection. You can verify exactly how your data is handled at every step."
              positive
            />
          </div>
        </section>

        <section className="mb-16">
          <div className="flex items-center space-x-3 mb-8">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Database className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-2xl font-black text-white">Data Flow Architecture</h2>
          </div>

          <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50">
            <div className="grid md:grid-cols-5 gap-4 items-center">
              <DataFlowStep
                step={1}
                title="Your Browser"
                description="Code stays local"
                icon={<Globe className="w-6 h-6" />}
              />
              <div className="hidden md:flex items-center justify-center">
                <div className="w-full h-0.5 bg-gradient-to-r from-emerald-500 to-blue-500" />
              </div>
              <DataFlowStep
                step={2}
                title="Direct to AI"
                description="Encrypted request"
                icon={<Lock className="w-6 h-6" />}
              />
              <div className="hidden md:flex items-center justify-center">
                <div className="w-full h-0.5 bg-gradient-to-r from-blue-500 to-purple-500" />
              </div>
              <DataFlowStep
                step={3}
                title="Instant Response"
                description="Results displayed"
                icon={<Zap className="w-6 h-6" />}
              />
            </div>

            <div className="mt-8 p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
              <div className="flex items-start space-x-3">
                <Trash2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-emerald-400 mb-1">Automatic Data Disposal</h4>
                  <p className="text-sm text-slate-300">
                    After your review is complete, all data is immediately disposed of. There's no database, no logs, 
                    no backup — your code simply ceases to exist in our system the moment you're done.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <div className="flex items-center space-x-3 mb-8">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Key className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="text-2xl font-black text-white">Credential Handling</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                <Shield className="w-5 h-5 text-emerald-400 mr-2" />
                GitHub Token
              </h3>
              <ul className="space-y-3">
                <SecurityPoint text="Stored only in your browser's localStorage" positive />
                <SecurityPoint text="Never transmitted to our servers" positive />
                <SecurityPoint text="Used directly for GitHub API calls" positive />
                <SecurityPoint text="You can revoke access anytime from GitHub" positive />
              </ul>
            </div>

            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                <Shield className="w-5 h-5 text-emerald-400 mr-2" />
                Google OAuth
              </h3>
              <ul className="space-y-3">
                <SecurityPoint text="Standard OAuth 2.0 flow" positive />
                <SecurityPoint text="We only access basic profile info" positive />
                <SecurityPoint text="No access to your emails or files" positive />
                <SecurityPoint text="Revoke anytime from Google Account settings" positive />
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <div className="flex items-center space-x-3 mb-8">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <XCircle className="w-5 h-5 text-red-400" />
            </div>
            <h2 className="text-2xl font-black text-white">What We DON'T Do</h2>
          </div>

          <div className="bg-red-500/5 rounded-2xl p-8 border border-red-500/20">
            <div className="grid md:grid-cols-2 gap-4">
              <NegativePoint text="Store or log your source code" />
              <NegativePoint text="Keep copies of your API keys" />
              <NegativePoint text="Track your coding patterns" />
              <NegativePoint text="Sell data to third parties" />
              <NegativePoint text="Use your code to train AI models" />
              <NegativePoint text="Access repositories without permission" />
              <NegativePoint text="Store review history on our servers" />
              <NegativePoint text="Share data with advertisers" />
            </div>
          </div>
        </section>

        <section className="mb-16">
          <div className="flex items-center space-x-3 mb-8">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Building className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-2xl font-black text-white">Enterprise Considerations</h2>
          </div>

          <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-bold text-white mb-4">Compliance Ready</h3>
                <p className="text-slate-400 mb-4">
                  Our zero-retention architecture makes compliance straightforward. Since we don't store data, 
                  there's nothing to audit, no data breach risk, and no compliance burden.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                    GDPR compliant by design
                  </li>
                  <li className="flex items-center text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                    SOC 2 friendly architecture
                  </li>
                  <li className="flex items-center text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                    No data residency concerns
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-4">Self-Hosted Option</h3>
                <p className="text-slate-400 mb-4">
                  For organizations requiring complete control, Gear PR Review can be self-hosted 
                  within your infrastructure. Contact us for enterprise deployment options.
                </p>
                <div className="p-4 bg-slate-900/50 rounded-xl">
                  <code className="text-sm text-indigo-400">
                    docker pull ghcr.io/nhonh/gear-pr-review:latest
                  </code>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="text-center py-12 border-t border-slate-800">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 mb-6">
            <Heart className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-4">Built with Trust</h2>
          <p className="text-slate-400 mb-6 max-w-xl mx-auto">
            We believe great tools should respect your privacy. Gear PR Review was built 
            by developers, for developers — with security as a foundational principle, not an afterthought.
          </p>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors"
          >
            Back to App
          </button>
        </section>
      </main>
    </div>
  );
};

const TrustCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}> = ({ icon, title, description, color }) => {
  const colorClasses: Record<string, string> = {
    emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30 text-emerald-400',
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/30 text-blue-400',
    purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/30 text-purple-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-2xl p-6 border text-center`}>
      <div className={`w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4 ${colorClasses[color].split(' ').pop()}`}>
        {icon}
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  );
};

const CommitmentRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  positive: boolean;
}> = ({ icon, title, description }) => (
  <div className="flex items-start space-x-4 p-6 border-b border-slate-700/50 last:border-0">
    <div className="shrink-0 mt-0.5">{icon}</div>
    <div>
      <h4 className="font-bold text-white mb-1">{title}</h4>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  </div>
);

const DataFlowStep: React.FC<{
  step: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}> = ({ step, title, description, icon }) => (
  <div className="text-center">
    <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center mx-auto mb-3 text-indigo-400">
      {icon}
    </div>
    <div className="text-xs font-bold text-indigo-400 mb-1">Step {step}</div>
    <h4 className="font-bold text-white text-sm">{title}</h4>
    <p className="text-xs text-slate-500">{description}</p>
  </div>
);

const SecurityPoint: React.FC<{ text: string; positive: boolean }> = ({ text, positive }) => (
  <li className="flex items-start space-x-2 text-sm">
    {positive ? (
      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
    ) : (
      <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
    )}
    <span className="text-slate-300">{text}</span>
  </li>
);

const NegativePoint: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex items-center space-x-2 text-sm">
    <XCircle className="w-4 h-4 text-red-400 shrink-0" />
    <span className="text-slate-300">{text}</span>
  </div>
);

export default SecurityPage;
