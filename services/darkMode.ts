type Theme = 'light' | 'dark' | 'system';

interface ThemeConfig {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
}

const STORAGE_KEY = 'gear-pr-review-theme';

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const resolveTheme = (theme: Theme): 'light' | 'dark' => {
  if (theme === 'system') return getSystemTheme();
  return theme;
};

export const getStoredTheme = (): Theme => {
  if (typeof localStorage === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  return stored || 'system';
};

export const setStoredTheme = (theme: Theme): void => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, theme);
};

export const getThemeConfig = (): ThemeConfig => {
  const theme = getStoredTheme();
  return {
    theme,
    resolvedTheme: resolveTheme(theme),
  };
};

export const applyTheme = (theme: 'light' | 'dark'): void => {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  
  if (theme === 'dark') {
    root.classList.add('dark');
    root.style.setProperty('--bg-primary', '#0f172a');
    root.style.setProperty('--bg-secondary', '#1e293b');
    root.style.setProperty('--bg-tertiary', '#334155');
    root.style.setProperty('--text-primary', '#f1f5f9');
    root.style.setProperty('--text-secondary', '#cbd5e1');
    root.style.setProperty('--text-muted', '#64748b');
    root.style.setProperty('--border-color', '#334155');
    root.style.setProperty('--accent-primary', '#6366f1');
    root.style.setProperty('--accent-secondary', '#818cf8');
    root.style.setProperty('--success', '#10b981');
    root.style.setProperty('--warning', '#f59e0b');
    root.style.setProperty('--danger', '#ef4444');
    root.style.setProperty('--shadow', '0 4px 6px -1px rgba(0, 0, 0, 0.3)');
  } else {
    root.classList.remove('dark');
    root.style.setProperty('--bg-primary', '#ffffff');
    root.style.setProperty('--bg-secondary', '#f8fafc');
    root.style.setProperty('--bg-tertiary', '#f1f5f9');
    root.style.setProperty('--text-primary', '#0f172a');
    root.style.setProperty('--text-secondary', '#334155');
    root.style.setProperty('--text-muted', '#64748b');
    root.style.setProperty('--border-color', '#e2e8f0');
    root.style.setProperty('--accent-primary', '#4f46e5');
    root.style.setProperty('--accent-secondary', '#6366f1');
    root.style.setProperty('--success', '#059669');
    root.style.setProperty('--warning', '#d97706');
    root.style.setProperty('--danger', '#dc2626');
    root.style.setProperty('--shadow', '0 4px 6px -1px rgba(0, 0, 0, 0.1)');
  }
  
  root.style.colorScheme = theme;
};

export const toggleTheme = (): ThemeConfig => {
  const current = getStoredTheme();
  let next: Theme;
  
  if (current === 'light') next = 'dark';
  else if (current === 'dark') next = 'system';
  else next = 'light';
  
  setStoredTheme(next);
  const resolved = resolveTheme(next);
  applyTheme(resolved);
  
  return { theme: next, resolvedTheme: resolved };
};

export const setTheme = (theme: Theme): ThemeConfig => {
  setStoredTheme(theme);
  const resolved = resolveTheme(theme);
  applyTheme(resolved);
  return { theme, resolvedTheme: resolved };
};

export const initTheme = (): ThemeConfig => {
  const config = getThemeConfig();
  applyTheme(config.resolvedTheme);
  
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (getStoredTheme() === 'system') {
        applyTheme(getSystemTheme());
      }
    });
  }
  
  return config;
};

export const getThemeIcon = (theme: Theme): string => {
  switch (theme) {
    case 'light': return '☀️';
    case 'dark': return '🌙';
    case 'system': return '💻';
  }
};

export const getThemeLabel = (theme: Theme): string => {
  switch (theme) {
    case 'light': return 'Light';
    case 'dark': return 'Dark';
    case 'system': return 'System';
  }
};

export const createThemeStylesheet = (): string => `
  :root {
    --bg-primary: #ffffff;
    --bg-secondary: #f8fafc;
    --bg-tertiary: #f1f5f9;
    --text-primary: #0f172a;
    --text-secondary: #334155;
    --text-muted: #64748b;
    --border-color: #e2e8f0;
    --accent-primary: #4f46e5;
    --accent-secondary: #6366f1;
    --success: #059669;
    --warning: #d97706;
    --danger: #dc2626;
    --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    
    color-scheme: light;
  }
  
  :root.dark {
    --bg-primary: #0f172a;
    --bg-secondary: #1e293b;
    --bg-tertiary: #334155;
    --text-primary: #f1f5f9;
    --text-secondary: #cbd5e1;
    --text-muted: #64748b;
    --border-color: #334155;
    --accent-primary: #6366f1;
    --accent-secondary: #818cf8;
    --success: #10b981;
    --warning: #f59e0b;
    --danger: #ef4444;
    --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
    
    color-scheme: dark;
  }
  
  body {
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    transition: background-color 0.2s ease, color 0.2s ease;
  }
  
  .theme-transition * {
    transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease !important;
  }
`;
