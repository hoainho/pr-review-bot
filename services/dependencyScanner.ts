import type { DependencyIssue, Severity } from '../types';

interface PackageInfo {
  name: string;
  version: string;
  devDependency: boolean;
}

interface VulnerabilityInfo {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  url: string;
  fixedIn?: string;
}

const KNOWN_VULNERABILITIES: Record<string, VulnerabilityInfo[]> = {
  'lodash': [
    { id: 'CVE-2021-23337', severity: 'HIGH', title: 'Command Injection', url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-23337', fixedIn: '4.17.21' },
    { id: 'CVE-2020-8203', severity: 'HIGH', title: 'Prototype Pollution', url: 'https://nvd.nist.gov/vuln/detail/CVE-2020-8203', fixedIn: '4.17.19' },
  ],
  'axios': [
    { id: 'CVE-2023-45857', severity: 'MEDIUM', title: 'CSRF/XSRF vulnerability', url: 'https://nvd.nist.gov/vuln/detail/CVE-2023-45857', fixedIn: '1.6.0' },
  ],
  'express': [
    { id: 'CVE-2024-29041', severity: 'MEDIUM', title: 'Open Redirect', url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-29041', fixedIn: '4.19.2' },
  ],
  'jsonwebtoken': [
    { id: 'CVE-2022-23529', severity: 'HIGH', title: 'Improper Verification', url: 'https://nvd.nist.gov/vuln/detail/CVE-2022-23529', fixedIn: '9.0.0' },
  ],
  'node-fetch': [
    { id: 'CVE-2022-0235', severity: 'MEDIUM', title: 'Exposure of Sensitive Information', url: 'https://nvd.nist.gov/vuln/detail/CVE-2022-0235', fixedIn: '3.1.1' },
  ],
  'tar': [
    { id: 'CVE-2021-37713', severity: 'HIGH', title: 'Arbitrary File Creation', url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-37713', fixedIn: '6.1.11' },
  ],
  'minimist': [
    { id: 'CVE-2021-44906', severity: 'CRITICAL', title: 'Prototype Pollution', url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-44906', fixedIn: '1.2.6' },
  ],
  'glob-parent': [
    { id: 'CVE-2020-28469', severity: 'HIGH', title: 'Regular Expression DoS', url: 'https://nvd.nist.gov/vuln/detail/CVE-2020-28469', fixedIn: '5.1.2' },
  ],
  'trim-newlines': [
    { id: 'CVE-2021-33623', severity: 'HIGH', title: 'Regular Expression DoS', url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-33623', fixedIn: '4.0.1' },
  ],
  'ansi-regex': [
    { id: 'CVE-2021-3807', severity: 'HIGH', title: 'Regular Expression DoS', url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-3807', fixedIn: '6.0.1' },
  ],
};

const DEPRECATED_PACKAGES: Record<string, string> = {
  'request': 'Use axios, node-fetch, or got instead',
  'node-uuid': 'Use uuid package instead',
  'querystring': 'Use URLSearchParams instead (built-in)',
  'domain': 'Use async_hooks instead',
  'sys': 'Use util instead',
  'natives': 'Package has been deprecated',
  'core-js': 'Consider using ponyfill-like packages for specific features',
  'left-pad': 'Use String.prototype.padStart() instead',
};

const MAINTENANCE_WARNINGS: Record<string, string> = {
  'moment': 'Consider migrating to date-fns or dayjs for better tree-shaking',
  'lodash': 'Consider using lodash-es or individual packages for better tree-shaking',
  'underscore': 'Consider migrating to lodash-es or native ES6+ features',
  'jquery': 'Consider using native DOM APIs or modern frameworks',
  'backbone': 'Consider migrating to modern frameworks like React or Vue',
  'angular': 'Legacy AngularJS - consider upgrading to Angular 2+',
};

const parseVersion = (version: string): { major: number; minor: number; patch: number } | null => {
  const cleaned = version.replace(/^[\^~>=<]/, '').split('.').slice(0, 3);
  if (cleaned.length < 3) return null;
  
  const [major, minor, patch] = cleaned.map(v => parseInt(v.replace(/[^\d]/g, ''), 10));
  if (isNaN(major) || isNaN(minor) || isNaN(patch)) return null;
  
  return { major, minor, patch };
};

const compareVersions = (current: string, fixed: string): boolean => {
  const curr = parseVersion(current);
  const fix = parseVersion(fixed);
  
  if (!curr || !fix) return false;
  
  if (curr.major < fix.major) return true;
  if (curr.major > fix.major) return false;
  
  if (curr.minor < fix.minor) return true;
  if (curr.minor > fix.minor) return false;
  
  return curr.patch < fix.patch;
};

const extractPackagesFromPackageJson = (content: string): PackageInfo[] => {
  try {
    const pkg = JSON.parse(content);
    const packages: PackageInfo[] = [];
    
    for (const [name, version] of Object.entries(pkg.dependencies || {})) {
      packages.push({ name, version: version as string, devDependency: false });
    }
    
    for (const [name, version] of Object.entries(pkg.devDependencies || {})) {
      packages.push({ name, version: version as string, devDependency: true });
    }
    
    return packages;
  } catch {
    return [];
  }
};

const extractPackagesFromLockfile = (content: string, fileName: string): PackageInfo[] => {
  const packages: PackageInfo[] = [];
  
  if (fileName.includes('package-lock.json')) {
    try {
      const lock = JSON.parse(content);
      const deps = lock.packages || lock.dependencies || {};
      
      for (const [path, info] of Object.entries(deps)) {
        if (!path || path === '') continue;
        const name = path.replace(/^node_modules\//, '');
        const version = (info as any).version;
        if (name && version) {
          packages.push({ name, version, devDependency: (info as any).dev || false });
        }
      }
    } catch {}
  }
  
  if (fileName.includes('yarn.lock')) {
    const versionPattern = /^"?([^@]+)@[^"]+":?\n\s+version:?\s+"?([^"\n]+)"?/gm;
    let match;
    while ((match = versionPattern.exec(content)) !== null) {
      packages.push({ name: match[1], version: match[2], devDependency: false });
    }
  }
  
  return packages;
};

export const scanDependencies = (
  packageJsonContent: string,
  lockfileContent?: string,
  lockfileName?: string
): DependencyIssue[] => {
  const issues: DependencyIssue[] = [];
  
  let packages = extractPackagesFromPackageJson(packageJsonContent);
  
  if (lockfileContent && lockfileName) {
    const lockPackages = extractPackagesFromLockfile(lockfileContent, lockfileName);
    const packageMap = new Map(packages.map(p => [p.name, p]));
    
    for (const lockPkg of lockPackages) {
      if (!packageMap.has(lockPkg.name)) {
        packages.push(lockPkg);
      }
    }
  }
  
  for (const pkg of packages) {
    const vulns = KNOWN_VULNERABILITIES[pkg.name];
    if (vulns) {
      for (const vuln of vulns) {
        if (vuln.fixedIn && compareVersions(pkg.version, vuln.fixedIn)) {
          issues.push({
            type: 'VULNERABILITY',
            severity: (vuln.severity === 'CRITICAL' ? 'CRITICAL' : vuln.severity) as Severity,
            package_name: pkg.name,
            current_version: pkg.version,
            recommended_version: vuln.fixedIn,
            cve_id: vuln.id,
            cve_severity: vuln.severity,
            description: `${vuln.title} - ${pkg.name}@${pkg.version} is vulnerable`,
            advisory_url: vuln.url,
            fix_command: `npm install ${pkg.name}@${vuln.fixedIn}`,
            affected_files: ['package.json'],
          });
        }
      }
    }
    
    const deprecation = DEPRECATED_PACKAGES[pkg.name];
    if (deprecation) {
      issues.push({
        type: 'OUTDATED',
        severity: 'MEDIUM' as Severity,
        package_name: pkg.name,
        current_version: pkg.version,
        description: `Package '${pkg.name}' is deprecated. ${deprecation}`,
        fix_command: `npm uninstall ${pkg.name}`,
        affected_files: ['package.json'],
      });
    }
    
    const maintenance = MAINTENANCE_WARNINGS[pkg.name];
    if (maintenance && !pkg.devDependency) {
      issues.push({
        type: 'MAINTENANCE_WARNING',
        severity: 'LOW' as Severity,
        package_name: pkg.name,
        current_version: pkg.version,
        description: maintenance,
        fix_command: `# Review and consider alternatives`,
        affected_files: ['package.json'],
      });
    }
  }
  
  return issues.sort((a, b) => {
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (severityOrder[a.severity as keyof typeof severityOrder] || 3) - 
           (severityOrder[b.severity as keyof typeof severityOrder] || 3);
  });
};

export const scanDiffForDependencyChanges = (diff: string): DependencyIssue[] => {
  const issues: DependencyIssue[] = [];
  
  let packageJsonContent = '';
  let inPackageJson = false;
  
  for (const line of diff.split('\n')) {
    if (line.includes('+++ b/package.json') || line.includes('+++ package.json')) {
      inPackageJson = true;
      continue;
    }
    
    if (inPackageJson && (line.startsWith('diff --git') || line.startsWith('--- '))) {
      break;
    }
    
    if (inPackageJson && line.startsWith('+') && !line.startsWith('+++')) {
      packageJsonContent += line.slice(1) + '\n';
    }
  }
  
  if (packageJsonContent) {
    try {
      const addedDeps = JSON.parse(`{${packageJsonContent.match(/"dependencies":\s*\{[^}]+\}/)?.[0] || ''}}`);
      const addedDevDeps = JSON.parse(`{${packageJsonContent.match(/"devDependencies":\s*\{[^}]+\}/)?.[0] || ''}}`);
      
      const combined = { ...addedDeps.dependencies, ...addedDevDeps.devDependencies };
      
      for (const [name, version] of Object.entries(combined)) {
        const vulns = KNOWN_VULNERABILITIES[name];
        if (vulns) {
          for (const vuln of vulns) {
            if (vuln.fixedIn && compareVersions(version as string, vuln.fixedIn)) {
              issues.push({
                type: 'VULNERABILITY',
                severity: vuln.severity as Severity,
                package_name: name,
                current_version: version as string,
                recommended_version: vuln.fixedIn,
                cve_id: vuln.id,
                cve_severity: vuln.severity,
                description: `New dependency ${name}@${version} has known vulnerability: ${vuln.title}`,
                advisory_url: vuln.url,
                fix_command: `npm install ${name}@${vuln.fixedIn}`,
                affected_files: ['package.json'],
              });
            }
          }
        }
      }
    } catch {}
  }
  
  return issues;
};

export const generateDependencyReport = (issues: DependencyIssue[]): string => {
  if (issues.length === 0) return '';
  
  let report = '\n=== DEPENDENCY SECURITY SCAN ===\n';
  report += `Found ${issues.length} issue(s)\n\n`;
  
  const byType = {
    VULNERABILITY: issues.filter(i => i.type === 'VULNERABILITY'),
    OUTDATED: issues.filter(i => i.type === 'OUTDATED'),
    MAINTENANCE_WARNING: issues.filter(i => i.type === 'MAINTENANCE_WARNING'),
    LICENSE_ISSUE: issues.filter(i => i.type === 'LICENSE_ISSUE'),
  };
  
  for (const [type, typeIssues] of Object.entries(byType)) {
    if (typeIssues.length === 0) continue;
    
    const emoji = type === 'VULNERABILITY' ? '🔴' : type === 'OUTDATED' ? '🟡' : '🔵';
    report += `\n${emoji} ${type.replace('_', ' ')} (${typeIssues.length}):\n`;
    
    for (const issue of typeIssues) {
      report += `\n  ${issue.package_name}@${issue.current_version}\n`;
      report += `    ${issue.description}\n`;
      if (issue.cve_id) report += `    CVE: ${issue.cve_id}\n`;
      if (issue.recommended_version) report += `    Fix: ${issue.fix_command}\n`;
    }
  }
  
  return report;
};
