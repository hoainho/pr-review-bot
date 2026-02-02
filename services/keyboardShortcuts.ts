import type { KeyboardShortcut, Command } from '../types';

type ShortcutCallback = () => void | Promise<void>;

interface ShortcutRegistry {
  shortcuts: Map<string, KeyboardShortcut>;
  commands: Map<string, Command>;
  enabled: boolean;
}

const registry: ShortcutRegistry = {
  shortcuts: new Map(),
  commands: new Map(),
  enabled: true,
};

const normalizeKey = (e: KeyboardEvent): string => {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Cmd');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');
  parts.push(e.key.toUpperCase());
  return parts.join('+');
};

const parseHotkey = (hotkey: string): { key: string; ctrl: boolean; shift: boolean; alt: boolean; meta: boolean } => {
  const parts = hotkey.toUpperCase().split('+');
  return {
    key: parts[parts.length - 1],
    ctrl: parts.includes('CMD') || parts.includes('CTRL'),
    shift: parts.includes('SHIFT'),
    alt: parts.includes('ALT'),
    meta: parts.includes('META'),
  };
};

export const registerShortcut = (shortcut: KeyboardShortcut): void => {
  const parsed = parseHotkey(shortcut.key);
  const normalizedKey = [
    parsed.ctrl || parsed.meta ? 'Cmd' : '',
    parsed.shift ? 'Shift' : '',
    parsed.alt ? 'Alt' : '',
    parsed.key,
  ].filter(Boolean).join('+');
  
  registry.shortcuts.set(normalizedKey, {
    ...shortcut,
    key: normalizedKey,
    ctrl: parsed.ctrl,
    shift: parsed.shift,
    alt: parsed.alt,
    meta: parsed.meta,
  });
};

export const unregisterShortcut = (key: string): void => {
  registry.shortcuts.delete(key);
};

export const registerCommand = (command: Command): void => {
  registry.commands.set(command.id, command);
  
  if (command.hotkey) {
    registerShortcut({
      key: command.hotkey,
      action: command.action,
      description: command.description,
      category: 'navigation',
    });
  }
};

export const unregisterCommand = (id: string): void => {
  const command = registry.commands.get(id);
  if (command?.hotkey) {
    unregisterShortcut(command.hotkey);
  }
  registry.commands.delete(id);
};

export const executeCommand = async (id: string): Promise<void> => {
  const command = registry.commands.get(id);
  if (command) {
    await command.action();
  }
};

export const getCommands = (): Command[] => {
  return Array.from(registry.commands.values());
};

export const getCommandsByCategory = (category: string): Command[] => {
  return getCommands().filter(c => c.category === category);
};

export const searchCommands = (query: string): Command[] => {
  const lower = query.toLowerCase();
  return getCommands().filter(c => 
    c.label.toLowerCase().includes(lower) ||
    c.description.toLowerCase().includes(lower) ||
    c.category.toLowerCase().includes(lower)
  );
};

const handleKeydown = (e: KeyboardEvent): void => {
  if (!registry.enabled) return;
  
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    if (!e.ctrlKey && !e.metaKey) return;
  }
  
  const key = normalizeKey(e);
  const shortcut = registry.shortcuts.get(key);
  
  if (shortcut) {
    e.preventDefault();
    shortcut.action();
  }
};

export const initKeyboardShortcuts = (): void => {
  if (typeof document === 'undefined') return;
  document.addEventListener('keydown', handleKeydown);
};

export const destroyKeyboardShortcuts = (): void => {
  if (typeof document === 'undefined') return;
  document.removeEventListener('keydown', handleKeydown);
};

export const enableShortcuts = (): void => {
  registry.enabled = true;
};

export const disableShortcuts = (): void => {
  registry.enabled = false;
};

export const getShortcuts = (): KeyboardShortcut[] => {
  return Array.from(registry.shortcuts.values());
};

export const getShortcutsByCategory = (category: KeyboardShortcut['category']): KeyboardShortcut[] => {
  return getShortcuts().filter(s => s.category === category);
};

export const formatHotkey = (hotkey: string): string => {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');
  
  return hotkey
    .replace(/Cmd\+/gi, isMac ? '⌘' : 'Ctrl+')
    .replace(/Shift\+/gi, isMac ? '⇧' : 'Shift+')
    .replace(/Alt\+/gi, isMac ? '⌥' : 'Alt+')
    .replace(/Meta\+/gi, isMac ? '⌘' : 'Win+');
};

export const DEFAULT_SHORTCUTS: Omit<KeyboardShortcut, 'action'>[] = [
  { key: 'Cmd+K', description: 'Open command palette', category: 'navigation' },
  { key: 'Cmd+Enter', description: 'Start PR analysis', category: 'analysis' },
  { key: 'Cmd+Shift+A', description: 'Approve all pending', category: 'review' },
  { key: 'Cmd+Shift+R', description: 'Reject all pending', category: 'review' },
  { key: 'Cmd+E', description: 'Export review', category: 'export' },
  { key: 'Cmd+Shift+D', description: 'Toggle dark mode', category: 'theme' },
  { key: 'Cmd+/', description: 'Show shortcuts help', category: 'navigation' },
  { key: 'J', description: 'Next issue', category: 'navigation' },
  { key: 'K', description: 'Previous issue', category: 'navigation' },
  { key: 'A', description: 'Approve current issue', category: 'review' },
  { key: 'R', description: 'Reject current issue', category: 'review' },
  { key: 'Escape', description: 'Close modal/palette', category: 'navigation' },
];

export const registerDefaultShortcuts = (callbacks: {
  openCommandPalette?: ShortcutCallback;
  startAnalysis?: ShortcutCallback;
  approveAll?: ShortcutCallback;
  rejectAll?: ShortcutCallback;
  exportReview?: ShortcutCallback;
  toggleTheme?: ShortcutCallback;
  showHelp?: ShortcutCallback;
  nextIssue?: ShortcutCallback;
  prevIssue?: ShortcutCallback;
  approveCurrent?: ShortcutCallback;
  rejectCurrent?: ShortcutCallback;
  closeModal?: ShortcutCallback;
}): void => {
  const actionMap: Record<string, ShortcutCallback | undefined> = {
    'Cmd+K': callbacks.openCommandPalette,
    'Cmd+Enter': callbacks.startAnalysis,
    'Cmd+Shift+A': callbacks.approveAll,
    'Cmd+Shift+R': callbacks.rejectAll,
    'Cmd+E': callbacks.exportReview,
    'Cmd+Shift+D': callbacks.toggleTheme,
    'Cmd+/': callbacks.showHelp,
    'J': callbacks.nextIssue,
    'K': callbacks.prevIssue,
    'A': callbacks.approveCurrent,
    'R': callbacks.rejectCurrent,
    'Escape': callbacks.closeModal,
  };
  
  for (const shortcut of DEFAULT_SHORTCUTS) {
    const action = actionMap[shortcut.key];
    if (action) {
      registerShortcut({ ...shortcut, action });
    }
  }
};
