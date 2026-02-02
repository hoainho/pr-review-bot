import React, { useEffect, useRef, useState } from 'react';
import { Terminal, FileCode, CheckCircle, AlertCircle, Loader2, Clock, Zap, Pause, Play, Square, CheckCircle2 } from 'lucide-react';
import { ReviewLogEntry } from '../types';

interface ReviewTerminalProps {
  logs: ReviewLogEntry[];
  isActive: boolean;
  isPaused?: boolean;
  currentFile?: string;
  progress?: {
    current: number;
    total: number;
    percentage: number;
  };
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
}

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
};

const LogIcon: React.FC<{ type: ReviewLogEntry['type']; message?: string }> = ({ type, message }) => {
  if (type === 'progress' && message?.includes('complete')) {
    return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  }
  
  switch (type) {
    case 'success':
      return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
    case 'error':
      return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
    case 'warning':
      return <AlertCircle className="w-3.5 h-3.5 text-amber-400" />;
    case 'progress':
      return <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />;
    default:
      return <Zap className="w-3.5 h-3.5 text-slate-400" />;
  }
};

const getLogColor = (type: ReviewLogEntry['type']): string => {
  switch (type) {
    case 'success': return 'text-emerald-400';
    case 'error': return 'text-red-400';
    case 'warning': return 'text-amber-400';
    case 'progress': return 'text-blue-400';
    default: return 'text-slate-300';
  }
};

export const ReviewTerminal: React.FC<ReviewTerminalProps> = ({
  logs,
  isActive,
  isPaused = false,
  currentFile,
  progress,
  onPause,
  onResume,
  onCancel
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const startTime = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (isActive && logs.length === 0) {
      startTime.current = Date.now();
    }
  }, [isActive, logs.length]);

  useEffect(() => {
    if (!isActive || isPaused) return;
    
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime.current);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isActive, isPaused]);

  const getStatusBadge = () => {
    if (!isActive && logs.length > 0) {
      const hasErrors = logs.some(l => l.type === 'error');
      if (hasErrors) {
        return (
          <span className="flex items-center space-x-1 text-red-400">
            <AlertCircle className="w-3 h-3" />
            <span>ERROR</span>
          </span>
        );
      }
      return (
        <span className="flex items-center space-x-1 text-emerald-400">
          <CheckCircle className="w-3 h-3" />
          <span>DONE</span>
        </span>
      );
    }
    if (isPaused) {
      return (
        <span className="flex items-center space-x-1 text-amber-400">
          <Pause className="w-3 h-3" />
          <span>PAUSED</span>
        </span>
      );
    }
    if (isActive) {
      return (
        <span className="flex items-center space-x-1 text-emerald-400">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span>LIVE</span>
        </span>
      );
    }
    return null;
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden font-mono text-xs">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-200 font-semibold">Review Process</span>
          {getStatusBadge()}
        </div>
        <div className="flex items-center space-x-3 text-slate-400">
          {(isActive || elapsed > 0) && (
            <span className="flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatDuration(elapsed)}</span>
            </span>
          )}
          {progress && (
            <span className="text-blue-400">
              {progress.current}/{progress.total} chunks
            </span>
          )}
          {isActive && (
            <div className="flex items-center space-x-1 ml-2">
              {isPaused ? (
                <button
                  onClick={onResume}
                  className="p-1 hover:bg-slate-700 rounded transition-colors text-emerald-400"
                  title="Resume"
                >
                  <Play className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={onPause}
                  className="p-1 hover:bg-slate-700 rounded transition-colors text-amber-400"
                  title="Pause"
                >
                  <Pause className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onCancel}
                className="p-1 hover:bg-slate-700 rounded transition-colors text-red-400"
                title="Cancel"
              >
                <Square className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {progress && (
        <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700">
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-400">Progress</span>
            <span className="text-slate-300">{progress.percentage}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-1.5">
            <div 
              className="bg-gradient-to-r from-blue-500 to-emerald-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {currentFile && isActive && (
        <div className={`px-4 py-2 border-b border-slate-700 flex items-center space-x-2 ${isPaused ? 'bg-amber-500/10' : 'bg-blue-500/10'}`}>
          <FileCode className={`w-4 h-4 ${isPaused ? 'text-amber-400' : 'text-blue-400'}`} />
          <span className={`truncate ${isPaused ? 'text-amber-300' : 'text-blue-300'}`}>{currentFile}</span>
          {isPaused ? (
            <Pause className="w-3.5 h-3.5 text-amber-400 ml-auto" />
          ) : (
            <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin ml-auto" />
          )}
        </div>
      )}

      <div 
        ref={terminalRef}
        className="h-64 min-h-[256px] max-h-[256px] overflow-y-auto p-3 space-y-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900"
      >
        {logs.length === 0 ? (
          <div className="text-slate-500 flex items-center justify-center h-full">
            {isActive ? 'Initializing review process...' : 'Waiting to start...'}
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="flex items-start space-x-2 leading-relaxed">
              <span className="text-slate-500 shrink-0">{formatTime(log.timestamp)}</span>
              <LogIcon type={log.type} message={log.message} />
              <span className={`${getLogColor(log.type)} break-all`}>
                {log.message}
                {log.details?.file && (
                  <span className="text-slate-500 ml-1">({log.details.file})</span>
                )}
                {log.details?.issuesFound !== undefined && (
                  <span className="text-amber-400 ml-1">[{log.details.issuesFound} issues]</span>
                )}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="px-4 py-2 bg-slate-800 border-t border-slate-700 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-slate-400">
          <span className="text-slate-500">$</span>
          {isActive && isPaused ? (
            <span className="text-amber-400 flex items-center">
              <span>paused</span>
              <span className="animate-pulse">_</span>
            </span>
          ) : isActive ? (
            <span className="text-emerald-400 flex items-center">
              <span>analyzing</span>
              <span className="animate-pulse">_</span>
            </span>
          ) : (
            <span className="text-slate-500">ready</span>
          )}
        </div>
        <div className="text-slate-500">
          {logs.filter(l => l.type === 'success').length} completed • 
          {logs.filter(l => l.type === 'error').length} errors
        </div>
      </div>
    </div>
  );
};

export default ReviewTerminal;
