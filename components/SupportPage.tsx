import React, { useState } from 'react';
import {
  Code2, ArrowLeft, MessageCircle, Mail, Github, Book, HelpCircle,
  CheckCircle2, ChevronDown, ChevronUp, ExternalLink, Zap, Bug,
  Lightbulb, Heart, Coffee, Star, AlertCircle, FileQuestion,
  Rocket, Users, Globe, Terminal
} from 'lucide-react';

interface SupportPageProps {
  onBack: () => void;
}

export const SupportPage: React.FC<SupportPageProps> = ({ onBack }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      question: "Why is my analysis taking a long time?",
      answer: "Large PRs (300+ files or 1000+ lines) are automatically chunked and processed sequentially to ensure accurate analysis. The Multi-AI Engine may also rotate between models if rate limits are encountered. You can monitor progress in the terminal view."
    },
    {
      question: "What AI models are used for analysis?",
      answer: "Gear PR Review uses a priority-based rotation system: Claude (Opus 4.5, Sonnet 4.5) → GPT (5.2 Codex, 5.1) → Gemini (3 Pro, 2.5 Pro, Flash variants). The system automatically switches to the next available model if one fails or hits rate limits."
    },
    {
      question: "Is my code stored or used for AI training?",
      answer: "Absolutely not. Your code is processed in real-time and immediately discarded. We have a zero-retention policy — no logs, no storage, no training data. Your API keys are stored only in your browser's localStorage."
    },
    {
      question: "Why do I need to provide a GitHub token?",
      answer: "The GitHub Personal Access Token is used to fetch PR diffs and post review comments. It's stored only in your browser and used directly for GitHub API calls. We never see or store your token."
    },
    {
      question: "Can I use this with private repositories?",
      answer: "Yes! Simply provide a GitHub Personal Access Token with appropriate repo permissions. The token is stored locally in your browser and used directly for API calls."
    },
    {
      question: "How do I enable Jira/Confluence integration?",
      answer: "Configure VITE_JIRA_EMAIL, VITE_JIRA_API_TOKEN, and optionally VITE_CONFLUENCE_API_TOKEN in your environment. The system will auto-discover linked tickets from your PR title and description."
    },
    {
      question: "What does 'React Best Practices' analyze?",
      answer: "It detects React-specific issues: unnecessary re-renders, waterfall requests, bundle size problems, improper hooks usage, state management anti-patterns, and server/client performance issues."
    },
    {
      question: "What does 'TypeScript Analyzer' check?",
      answer: "29 rules across 7 categories: type safety (no any, unsafe assertions), null safety, generics, enums, strict mode compliance, import optimization, and pattern enforcement (discriminated unions, exhaustive switches)."
    },
    {
      question: "Can I self-host Gear PR Review?",
      answer: "Yes! The application can be built and deployed to your own infrastructure. Clone the repo, configure environment variables, and run 'npm run build'. Docker images are also available."
    },
    {
      question: "How do I report a bug or request a feature?",
      answer: "Open an issue on our GitHub repository. For bugs, please include: browser version, error messages, and steps to reproduce. For features, describe your use case and expected behavior."
    }
  ];

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
              <HelpCircle className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-black text-white">Support</span>
          </div>
          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo-500/20 border border-indigo-500/30 mb-6">
            <MessageCircle className="w-10 h-10 text-indigo-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
            How Can We Help?
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Find answers to common questions, report issues, or reach out to our team.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <SupportCard
            icon={<Book className="w-6 h-6" />}
            title="Documentation"
            description="Comprehensive guides, tutorials, and API references."
            action="Read Docs"
            href="#"
            color="indigo"
          />
          <SupportCard
            icon={<Github className="w-6 h-6" />}
            title="GitHub Issues"
            description="Report bugs, request features, or contribute code."
            action="Open Issue"
            href="https://github.com/hoainho/pr-review-bot/issues"
            color="slate"
            external
          />
          <SupportCard
            icon={<Mail className="w-6 h-6" />}
            title="Email Support"
            description="Direct support for enterprise or urgent matters."
            action="Contact Us"
            href="mailto:hoainho.work@gmail.com"
            color="emerald"
          />
        </div>

        <section className="mb-16">
          <div className="flex items-center space-x-3 mb-8">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <FileQuestion className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="text-2xl font-black text-white">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="font-bold text-white pr-4">{faq.question}</span>
                  {openFaq === index ? (
                    <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                  )}
                </button>
                {openFaq === index && (
                  <div className="px-5 pb-5 pt-0">
                    <p className="text-slate-400 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <div className="flex items-center space-x-3 mb-8">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <Bug className="w-5 h-5 text-red-400" />
            </div>
            <h2 className="text-2xl font-black text-white">Report an Issue</h2>
          </div>

          <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50">
            <p className="text-slate-400 mb-6">
              Found a bug? Help us fix it by providing detailed information:
            </p>
            
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-4">
                <h3 className="font-bold text-white flex items-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                  Include in Bug Reports
                </h3>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li>• Browser and version (e.g., Chrome 120)</li>
                  <li>• Steps to reproduce the issue</li>
                  <li>• Expected vs actual behavior</li>
                  <li>• Console error messages (if any)</li>
                  <li>• Screenshots or recordings</li>
                </ul>
              </div>
              <div className="space-y-4">
                <h3 className="font-bold text-white flex items-center">
                  <Lightbulb className="w-4 h-4 text-amber-400 mr-2" />
                  Feature Requests
                </h3>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li>• Describe your use case</li>
                  <li>• Explain the expected behavior</li>
                  <li>• Share mockups if applicable</li>
                  <li>• Note any workarounds you've tried</li>
                  <li>• Mention related features</li>
                </ul>
              </div>
            </div>

            <a
              href="https://github.com/hoainho/pr-review-bot/issues/new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-colors"
            >
              <Github className="w-5 h-5" />
              <span>Open GitHub Issue</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </section>

        <section className="mb-16">
          <div className="flex items-center space-x-3 mb-8">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Terminal className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-2xl font-black text-white">Troubleshooting</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <TroubleshootCard
              title="Analysis Fails Immediately"
              solutions={[
                "Check your GitHub token has 'repo' permissions",
                "Verify the PR URL format is correct",
                "Ensure the repository is accessible",
                "Check browser console for error details"
              ]}
            />
            <TroubleshootCard
              title="Rate Limit Errors"
              solutions={[
                "The Multi-AI Engine will auto-rotate to another model",
                "Wait 60 seconds if all models are exhausted",
                "Consider splitting very large PRs",
                "Check your API quota in provider dashboards"
              ]}
            />
            <TroubleshootCard
              title="Comments Not Posting to GitHub"
              solutions={[
                "Verify token has 'write' permissions on the repo",
                "Check you're not blocked by branch protection rules",
                "Ensure you're signed in with correct account",
                "Try regenerating your GitHub token"
              ]}
            />
            <TroubleshootCard
              title="Jira Integration Not Working"
              solutions={[
                "Verify JIRA_EMAIL and JIRA_API_TOKEN are set",
                "Check ticket format in PR title (e.g., PROJECT-123)",
                "Ensure API token has read permissions",
                "Check browser console for CORS or auth errors"
              ]}
            />
          </div>
        </section>

        <section className="mb-16">
          <div className="flex items-center space-x-3 mb-8">
            <div className="p-2 bg-pink-500/20 rounded-lg">
              <Users className="w-5 h-5 text-pink-400" />
            </div>
            <h2 className="text-2xl font-black text-white">Community</h2>
          </div>

          <div className="bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-2xl p-8 border border-indigo-500/30">
            <div className="text-center">
              <h3 className="text-xl font-bold text-white mb-4">Join Our Growing Community</h3>
              <p className="text-slate-400 mb-6 max-w-xl mx-auto">
                Connect with other developers using Gear PR Review. Share tips, get help, 
                and stay updated on new features.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <a
                  href="https://github.com/hoainho/pr-review-bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-colors"
                >
                  <Github className="w-5 h-5" />
                  <span>Star on GitHub</span>
                </a>
                <a
                  href="https://github.com/hoainho/pr-review-bot/discussions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-colors"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>Discussions</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="text-center py-12 border-t border-slate-800">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-pink-500/20 border border-pink-500/30 mb-6">
            <Heart className="w-8 h-8 text-pink-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-4">Made with Love</h2>
          <p className="text-slate-400 mb-6 max-w-xl mx-auto">
            Gear PR Review is built and maintained by developers who care about code quality. 
            Your feedback helps us make it better for everyone.
          </p>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors"
          >
            Back to App
          </button>
        </section>
      </main>
    </div>
  );
};

const SupportCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
  href: string;
  color: string;
  external?: boolean;
}> = ({ icon, title, description, action, href, color, external }) => {
  const colorClasses: Record<string, string> = {
    indigo: 'from-indigo-500/20 to-indigo-600/5 border-indigo-500/30 hover:border-indigo-500/50',
    slate: 'from-slate-500/20 to-slate-600/5 border-slate-500/30 hover:border-slate-500/50',
    emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30 hover:border-emerald-500/50',
  };

  const iconColors: Record<string, string> = {
    indigo: 'text-indigo-400',
    slate: 'text-slate-400',
    emerald: 'text-emerald-400',
  };

  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={`block bg-gradient-to-br ${colorClasses[color]} rounded-2xl p-6 border transition-colors`}
    >
      <div className={`w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mb-4 ${iconColors[color]}`}>
        {icon}
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400 mb-4">{description}</p>
      <span className={`text-sm font-bold ${iconColors[color]} flex items-center`}>
        {action}
        {external && <ExternalLink className="w-3 h-3 ml-1" />}
      </span>
    </a>
  );
};

const TroubleshootCard: React.FC<{
  title: string;
  solutions: string[];
}> = ({ title, solutions }) => (
  <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
    <h3 className="font-bold text-white mb-4 flex items-center">
      <AlertCircle className="w-5 h-5 text-amber-400 mr-2" />
      {title}
    </h3>
    <ul className="space-y-2">
      {solutions.map((solution, i) => (
        <li key={i} className="flex items-start space-x-2 text-sm text-slate-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{solution}</span>
        </li>
      ))}
    </ul>
  </div>
);

export default SupportPage;
