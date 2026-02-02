import type { AnalysisProgress } from '../types';

type ProgressCallback = (progress: AnalysisProgress) => void;

interface ProgressState {
  startTime: number;
  stages: {
    name: string;
    weight: number;
    completed: boolean;
    startTime?: number;
    endTime?: number;
  }[];
  currentStageIndex: number;
  callbacks: Set<ProgressCallback>;
}

const DEFAULT_STAGES = [
  { name: 'Fetching PR diff', weight: 15 },
  { name: 'Loading repository context', weight: 20 },
  { name: 'Analyzing code patterns', weight: 10 },
  { name: 'Running AI analysis', weight: 40 },
  { name: 'Detecting performance issues', weight: 5 },
  { name: 'Checking breaking changes', weight: 5 },
  { name: 'Finalizing results', weight: 5 },
];

let state: ProgressState | null = null;

export const startProgress = (customStages?: { name: string; weight: number }[]): void => {
  const stages = customStages || DEFAULT_STAGES;
  state = {
    startTime: Date.now(),
    stages: stages.map(s => ({ ...s, completed: false })),
    currentStageIndex: 0,
    callbacks: new Set(),
  };
  notifyCallbacks();
};

export const advanceStage = (): void => {
  if (!state) return;
  
  const currentStage = state.stages[state.currentStageIndex];
  if (currentStage) {
    currentStage.completed = true;
    currentStage.endTime = Date.now();
  }
  
  state.currentStageIndex++;
  
  const nextStage = state.stages[state.currentStageIndex];
  if (nextStage) {
    nextStage.startTime = Date.now();
  }
  
  notifyCallbacks();
};

export const setStage = (index: number): void => {
  if (!state) return;
  
  for (let i = 0; i < index && i < state.stages.length; i++) {
    state.stages[i].completed = true;
  }
  
  state.currentStageIndex = Math.min(index, state.stages.length - 1);
  notifyCallbacks();
};

export const completeProgress = (): void => {
  if (!state) return;
  
  for (const stage of state.stages) {
    stage.completed = true;
  }
  state.currentStageIndex = state.stages.length;
  notifyCallbacks();
};

export const resetProgress = (): void => {
  state = null;
};

export const getProgress = (): AnalysisProgress | null => {
  if (!state) return null;
  
  const completedWeight = state.stages
    .filter(s => s.completed)
    .reduce((sum, s) => sum + s.weight, 0);
  
  const totalWeight = state.stages.reduce((sum, s) => sum + s.weight, 0);
  const percentage = Math.round((completedWeight / totalWeight) * 100);
  
  const currentStage = state.stages[state.currentStageIndex];
  const stagesCompleted = state.stages.filter(s => s.completed).length;
  
  let eta: number | undefined;
  if (stagesCompleted > 0 && state.currentStageIndex < state.stages.length) {
    const elapsed = Date.now() - state.startTime;
    const progressPerMs = completedWeight / elapsed;
    const remainingWeight = totalWeight - completedWeight;
    eta = Math.round(remainingWeight / progressPerMs);
  }
  
  const stage = state.currentStageIndex >= state.stages.length ? 'complete' :
                state.currentStageIndex === 0 ? 'fetching' :
                state.currentStageIndex < 4 ? 'analyzing' : 'categorizing';
  
  return {
    stage: stage as AnalysisProgress['stage'],
    percentage,
    current_task: currentStage?.name || 'Complete',
    eta,
    stages_completed: stagesCompleted,
    total_stages: state.stages.length,
  };
};

export const subscribeToProgress = (callback: ProgressCallback): () => void => {
  if (!state) {
    startProgress();
  }
  state!.callbacks.add(callback);
  
  const current = getProgress();
  if (current) callback(current);
  
  return () => {
    state?.callbacks.delete(callback);
  };
};

const notifyCallbacks = (): void => {
  if (!state) return;
  const progress = getProgress();
  if (progress) {
    for (const callback of state.callbacks) {
      callback(progress);
    }
  }
};

export const formatETA = (ms: number): string => {
  if (ms < 1000) return 'less than a second';
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  return `${Math.round(ms / 3600000)}h ${Math.round((ms % 3600000) / 60000)}m`;
};

export const formatProgress = (progress: AnalysisProgress): string => {
  let status = `${progress.current_task} (${progress.percentage}%)`;
  if (progress.eta) {
    status += ` - ETA: ${formatETA(progress.eta)}`;
  }
  return status;
};

export const createProgressBar = (progress: AnalysisProgress, width = 30): string => {
  const filled = Math.round((progress.percentage / 100) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${progress.percentage}%`;
};

export class ProgressTracker {
  private state: ProgressState | null = null;
  
  constructor(customStages?: { name: string; weight: number }[]) {
    this.start(customStages);
  }
  
  start(customStages?: { name: string; weight: number }[]): this {
    const stages = customStages || DEFAULT_STAGES;
    this.state = {
      startTime: Date.now(),
      stages: stages.map(s => ({ ...s, completed: false })),
      currentStageIndex: 0,
      callbacks: new Set(),
    };
    this.notify();
    return this;
  }
  
  advance(): this {
    if (!this.state) return this;
    
    const current = this.state.stages[this.state.currentStageIndex];
    if (current) {
      current.completed = true;
      current.endTime = Date.now();
    }
    
    this.state.currentStageIndex++;
    
    const next = this.state.stages[this.state.currentStageIndex];
    if (next) next.startTime = Date.now();
    
    this.notify();
    return this;
  }
  
  complete(): this {
    if (!this.state) return this;
    
    for (const stage of this.state.stages) {
      stage.completed = true;
    }
    this.state.currentStageIndex = this.state.stages.length;
    this.notify();
    return this;
  }
  
  subscribe(callback: ProgressCallback): () => void {
    if (!this.state) this.start();
    this.state!.callbacks.add(callback);
    
    const current = this.getProgress();
    if (current) callback(current);
    
    return () => this.state?.callbacks.delete(callback);
  }
  
  getProgress(): AnalysisProgress | null {
    if (!this.state) return null;
    
    const completedWeight = this.state.stages
      .filter(s => s.completed)
      .reduce((sum, s) => sum + s.weight, 0);
    
    const totalWeight = this.state.stages.reduce((sum, s) => sum + s.weight, 0);
    const percentage = Math.round((completedWeight / totalWeight) * 100);
    
    const currentStage = this.state.stages[this.state.currentStageIndex];
    const stagesCompleted = this.state.stages.filter(s => s.completed).length;
    
    let eta: number | undefined;
    if (stagesCompleted > 0 && this.state.currentStageIndex < this.state.stages.length) {
      const elapsed = Date.now() - this.state.startTime;
      const progressPerMs = completedWeight / elapsed;
      const remainingWeight = totalWeight - completedWeight;
      eta = Math.round(remainingWeight / progressPerMs);
    }
    
    const stage = this.state.currentStageIndex >= this.state.stages.length ? 'complete' :
                  this.state.currentStageIndex === 0 ? 'fetching' :
                  this.state.currentStageIndex < 4 ? 'analyzing' : 'categorizing';
    
    return {
      stage: stage as AnalysisProgress['stage'],
      percentage,
      current_task: currentStage?.name || 'Complete',
      eta,
      stages_completed: stagesCompleted,
      total_stages: this.state.stages.length,
    };
  }
  
  private notify(): void {
    if (!this.state) return;
    const progress = this.getProgress();
    if (progress) {
      for (const callback of this.state.callbacks) {
        callback(progress);
      }
    }
  }
}
