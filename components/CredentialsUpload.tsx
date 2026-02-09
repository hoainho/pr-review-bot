import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileJson, CheckCircle2, AlertCircle, Loader2, X, Key, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { 
  uploadCredentials, 
  parseCredentialsFile, 
  checkCredentialsStatus,
  formatExpiryDate 
} from '../services/credentialsService';
import type { CredentialsStatus } from '../types';

interface CredentialsUploadProps {
  onSuccess?: () => void;
  credentialsStatus?: CredentialsStatus | null;
  onStatusChange?: (status: CredentialsStatus | null) => void;
}

export function CredentialsUpload({ onSuccess, credentialsStatus, onStatusChange }: CredentialsUploadProps) {
  const { user } = useAuth();
  const [jsonInput, setJsonInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCheckStatus = useCallback(async () => {
    if (!user?.idToken) return;
    
    setIsChecking(true);
    try {
      const status = await checkCredentialsStatus(user.idToken);
      onStatusChange?.(status);
    } catch {
      onStatusChange?.(null);
    } finally {
      setIsChecking(false);
    }
  }, [user?.idToken, onStatusChange]);

  const handleUpload = useCallback(async (content: string) => {
    if (!user?.idToken) {
      setError('Not authenticated. Please sign in again.');
      return;
    }

    setError(null);
    setSuccess(null);

    const { valid, error: parseError, credentials } = parseCredentialsFile(content);
    
    if (!valid || !credentials) {
      setError(parseError || 'Invalid credentials format');
      return;
    }

    setIsUploading(true);

    try {
      const response = await uploadCredentials(credentials, user.idToken);
      
      if (response.success) {
        setSuccess(`Credentials uploaded for ${response.email}`);
        setJsonInput('');
        onSuccess?.();
        handleCheckStatus();
      } else {
        setError(response.message || 'Upload failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [user?.idToken, onSuccess, handleCheckStatus]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setError('Please upload a JSON file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonInput(content);
      handleUpload(content);
    };
    reader.onerror = () => setError('Failed to read file');
    reader.readAsText(file);
  }, [handleUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonInput(content);
      handleUpload(content);
    };
    reader.onerror = () => setError('Failed to read file');
    reader.readAsText(file);
  }, [handleUpload]);

  const handlePasteUpload = useCallback(() => {
    if (!jsonInput.trim()) {
      setError('Please paste your credentials JSON');
      return;
    }
    handleUpload(jsonInput);
  }, [jsonInput, handleUpload]);

  if (credentialsStatus?.hasCredentials) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-400">Credentials Active</p>
              <p className="text-xs text-slate-400">
                {credentialsStatus.email} • {formatExpiryDate(credentialsStatus.expired || '')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCheckStatus}
              disabled={isChecking}
              className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
              title="Refresh status"
            >
              <RefreshCw className={`w-4 h-4 text-slate-400 ${isChecking ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => onStatusChange?.(null)}
              className="text-xs text-slate-400 hover:text-slate-300 px-2 py-1"
            >
              Update
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
          <Key className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Setup Required</h3>
          <p className="text-xs text-slate-400">Upload your Antigravity credentials to use the API</p>
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
          ${isDragging 
            ? 'border-indigo-500 bg-indigo-500/10' 
            : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Upload className={`w-8 h-8 mx-auto mb-2 ${isDragging ? 'text-indigo-400' : 'text-slate-500'}`} />
        <p className="text-sm text-slate-300 mb-1">
          {isDragging ? 'Drop your file here' : 'Drag & drop your credentials file'}
        </p>
        <p className="text-xs text-slate-500">or click to browse</p>
      </div>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-700"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-2 bg-slate-800 text-slate-500">or paste JSON</span>
        </div>
      </div>

      <div className="relative">
        <FileJson className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder='{"access_token": "ya29...", "refresh_token": "1//...", ...}'
          className="w-full h-32 pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-mono resize-none"
        />
        {jsonInput && (
          <button
            onClick={() => setJsonInput('')}
            className="absolute right-3 top-3 p-1 hover:bg-slate-700 rounded"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        )}
      </div>

      <button
        onClick={handlePasteUpload}
        disabled={isUploading || !jsonInput.trim()}
        className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
      >
        {isUploading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            Upload Credentials
          </>
        )}
      </button>

      {error && (
        <div className="mt-4 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="mt-4 flex items-start gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-400">{success}</p>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-500 text-center">
        Your credentials are stored securely on the server and used only for API authentication.
      </p>
    </div>
  );
}
