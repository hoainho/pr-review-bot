import type { BreakingChange, Severity } from '../types';

interface FunctionSignature {
  name: string;
  params: string[];
  returnType?: string;
  exported: boolean;
  async: boolean;
}

interface TypeDefinition {
  name: string;
  kind: 'interface' | 'type' | 'enum' | 'class';
  properties: string[];
  exported: boolean;
}

interface ExportedConstant {
  name: string;
  type?: string;
  value?: string;
}

const extractFunctionSignatures = (code: string): FunctionSignature[] => {
  const signatures: FunctionSignature[] = [];
  
  const functionPatterns = [
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?/g,
    /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)(?:\s*:\s*([^=]+))?\s*=>/g,
    /(?:export\s+)?(?:async\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*\{/g,
  ];

  for (const pattern of functionPatterns) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(code)) !== null) {
      const fullMatch = match[0];
      const name = match[1];
      const paramsStr = match[2] || '';
      const returnType = match[3]?.trim();
      
      const params = paramsStr
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);
      
      signatures.push({
        name,
        params,
        returnType,
        exported: fullMatch.includes('export'),
        async: fullMatch.includes('async'),
      });
    }
  }
  
  return signatures;
};

const extractTypeDefinitions = (code: string): TypeDefinition[] => {
  const types: TypeDefinition[] = [];
  
  const interfacePattern = /(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+[^{]+)?\s*\{([^}]+)\}/g;
  const typePattern = /(?:export\s+)?type\s+(\w+)\s*=\s*([^;]+);/g;
  const enumPattern = /(?:export\s+)?enum\s+(\w+)\s*\{([^}]+)\}/g;
  
  let match: RegExpExecArray | null;
  
  interfacePattern.lastIndex = 0;
  while ((match = interfacePattern.exec(code)) !== null) {
    const properties = match[2]
      .split(/[;\n]/)
      .map(p => p.trim().split(':')[0]?.trim())
      .filter(p => p && !p.startsWith('//'));
    
    types.push({
      name: match[1],
      kind: 'interface',
      properties,
      exported: match[0].includes('export'),
    });
  }
  
  typePattern.lastIndex = 0;
  while ((match = typePattern.exec(code)) !== null) {
    types.push({
      name: match[1],
      kind: 'type',
      properties: [match[2].trim()],
      exported: match[0].includes('export'),
    });
  }
  
  enumPattern.lastIndex = 0;
  while ((match = enumPattern.exec(code)) !== null) {
    const values = match[2]
      .split(',')
      .map(v => v.trim().split('=')[0]?.trim())
      .filter(v => v);
    
    types.push({
      name: match[1],
      kind: 'enum',
      properties: values,
      exported: match[0].includes('export'),
    });
  }
  
  return types;
};

const extractExportedConstants = (code: string): ExportedConstant[] => {
  const constants: ExportedConstant[] = [];
  const pattern = /export\s+const\s+(\w+)(?:\s*:\s*([^=]+))?\s*=\s*([^;]+);/g;
  
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    constants.push({
      name: match[1],
      type: match[2]?.trim(),
      value: match[3]?.trim().slice(0, 50),
    });
  }
  
  return constants;
};

const compareSignatures = (
  oldSig: FunctionSignature,
  newSig: FunctionSignature,
  fileName: string,
  lineNumber: string
): BreakingChange | null => {
  if (oldSig.params.length !== newSig.params.length) {
    const isAddition = newSig.params.length > oldSig.params.length;
    const hasDefaults = newSig.params.slice(oldSig.params.length).every(p => p.includes('=') || p.includes('?'));
    
    if (!hasDefaults) {
      return {
        type: 'SIGNATURE_CHANGE',
        severity: 'HIGH' as Severity,
        file_name: fileName,
        line_numbers: lineNumber,
        description: `Function '${oldSig.name}' parameter count changed from ${oldSig.params.length} to ${newSig.params.length}`,
        impact: `All callers of ${oldSig.name}() must update their function calls`,
        affected_consumers: [`All files importing and calling ${oldSig.name}`],
        migration_path: isAddition 
          ? `Add default values for new parameters or update all call sites`
          : `Remove parameters from all call sites`,
        code_before: `${oldSig.name}(${oldSig.params.join(', ')})`,
        code_after: `${newSig.name}(${newSig.params.join(', ')})`,
        semver_impact: 'MAJOR',
      };
    }
  }
  
  if (oldSig.returnType && newSig.returnType && oldSig.returnType !== newSig.returnType) {
    return {
      type: 'TYPE_CHANGE',
      severity: 'MEDIUM' as Severity,
      file_name: fileName,
      line_numbers: lineNumber,
      description: `Function '${oldSig.name}' return type changed from '${oldSig.returnType}' to '${newSig.returnType}'`,
      impact: `Consumers expecting ${oldSig.returnType} may fail at runtime`,
      affected_consumers: [`All files using return value of ${oldSig.name}`],
      migration_path: `Update all consumers to handle new return type '${newSig.returnType}'`,
      code_before: `function ${oldSig.name}(): ${oldSig.returnType}`,
      code_after: `function ${newSig.name}(): ${newSig.returnType}`,
      semver_impact: 'MAJOR',
    };
  }
  
  if (oldSig.async !== newSig.async) {
    return {
      type: 'BEHAVIOR_CHANGE',
      severity: 'HIGH' as Severity,
      file_name: fileName,
      line_numbers: lineNumber,
      description: `Function '${oldSig.name}' async behavior changed: ${oldSig.async ? 'async → sync' : 'sync → async'}`,
      impact: newSig.async 
        ? 'All callers must now await this function'
        : 'Callers awaiting this function will receive value directly instead of Promise',
      affected_consumers: [`All files calling ${oldSig.name}`],
      migration_path: newSig.async
        ? `Add 'await' before all calls to ${oldSig.name}()`
        : `Remove 'await' from all calls to ${newSig.name}()`,
      code_before: `${oldSig.async ? 'async ' : ''}function ${oldSig.name}()`,
      code_after: `${newSig.async ? 'async ' : ''}function ${newSig.name}()`,
      semver_impact: 'MAJOR',
    };
  }
  
  return null;
};

const compareTypes = (
  oldType: TypeDefinition,
  newType: TypeDefinition,
  fileName: string,
  lineNumber: string
): BreakingChange[] => {
  const changes: BreakingChange[] = [];
  
  const removedProps = oldType.properties.filter(p => !newType.properties.includes(p));
  const addedRequiredProps = newType.properties.filter(p => 
    !oldType.properties.includes(p) && !p.includes('?')
  );
  
  if (removedProps.length > 0) {
    changes.push({
      type: 'TYPE_CHANGE',
      severity: 'HIGH' as Severity,
      file_name: fileName,
      line_numbers: lineNumber,
      description: `${oldType.kind} '${oldType.name}' removed properties: ${removedProps.join(', ')}`,
      impact: `Code accessing ${removedProps.join(', ')} will fail`,
      affected_consumers: [`All files using ${oldType.name}.${removedProps[0]}`],
      migration_path: `Remove usage of deprecated properties: ${removedProps.join(', ')}`,
      code_before: `${oldType.kind} ${oldType.name} { ${oldType.properties.join('; ')} }`,
      code_after: `${newType.kind} ${newType.name} { ${newType.properties.join('; ')} }`,
      semver_impact: 'MAJOR',
    });
  }
  
  if (addedRequiredProps.length > 0 && oldType.kind === 'interface') {
    changes.push({
      type: 'TYPE_CHANGE',
      severity: 'MEDIUM' as Severity,
      file_name: fileName,
      line_numbers: lineNumber,
      description: `${oldType.kind} '${oldType.name}' added required properties: ${addedRequiredProps.join(', ')}`,
      impact: `Existing objects of type ${oldType.name} missing new required properties`,
      affected_consumers: [`All files creating objects of type ${oldType.name}`],
      migration_path: `Add required properties to all ${oldType.name} objects: ${addedRequiredProps.join(', ')}`,
      code_before: `${oldType.kind} ${oldType.name} { ${oldType.properties.join('; ')} }`,
      code_after: `${newType.kind} ${newType.name} { ${newType.properties.join('; ')} }`,
      semver_impact: 'MAJOR',
    });
  }
  
  return changes;
};

export const detectBreakingChanges = (
  oldCode: string,
  newCode: string,
  fileName: string
): BreakingChange[] => {
  const changes: BreakingChange[] = [];
  
  const oldFunctions = extractFunctionSignatures(oldCode);
  const newFunctions = extractFunctionSignatures(newCode);
  const oldTypes = extractTypeDefinitions(oldCode);
  const newTypes = extractTypeDefinitions(newCode);
  const oldConstants = extractExportedConstants(oldCode);
  const newConstants = extractExportedConstants(newCode);
  
  for (const oldFn of oldFunctions.filter(f => f.exported)) {
    const newFn = newFunctions.find(f => f.name === oldFn.name);
    
    if (!newFn) {
      changes.push({
        type: 'API_REMOVAL',
        severity: 'CRITICAL' as Severity,
        file_name: fileName,
        line_numbers: '1',
        description: `Exported function '${oldFn.name}' was removed`,
        impact: `All imports of ${oldFn.name} will fail`,
        affected_consumers: [`All files importing ${oldFn.name} from ${fileName}`],
        migration_path: `Either restore the function or update all consumers to use alternative`,
        code_before: `export function ${oldFn.name}(${oldFn.params.join(', ')})`,
        code_after: '// Function removed',
        semver_impact: 'MAJOR',
      });
    } else {
      const signatureChange = compareSignatures(oldFn, newFn, fileName, '1');
      if (signatureChange) changes.push(signatureChange);
    }
  }
  
  for (const oldType of oldTypes.filter(t => t.exported)) {
    const newType = newTypes.find(t => t.name === oldType.name);
    
    if (!newType) {
      changes.push({
        type: 'API_REMOVAL',
        severity: 'HIGH' as Severity,
        file_name: fileName,
        line_numbers: '1',
        description: `Exported ${oldType.kind} '${oldType.name}' was removed`,
        impact: `All imports of ${oldType.name} will fail`,
        affected_consumers: [`All files importing ${oldType.name}`],
        migration_path: `Restore the type or update all consumers`,
        code_before: `export ${oldType.kind} ${oldType.name}`,
        code_after: '// Type removed',
        semver_impact: 'MAJOR',
      });
    } else {
      changes.push(...compareTypes(oldType, newType, fileName, '1'));
    }
  }
  
  for (const oldConst of oldConstants) {
    const newConst = newConstants.find(c => c.name === oldConst.name);
    
    if (!newConst) {
      changes.push({
        type: 'CONSTANT_REMOVAL',
        severity: 'MEDIUM' as Severity,
        file_name: fileName,
        line_numbers: '1',
        description: `Exported constant '${oldConst.name}' was removed`,
        impact: `All imports of ${oldConst.name} will fail`,
        affected_consumers: [`All files importing ${oldConst.name}`],
        migration_path: `Restore the constant or update consumers`,
        code_before: `export const ${oldConst.name} = ${oldConst.value}`,
        code_after: '// Constant removed',
        semver_impact: 'MINOR',
      });
    }
  }
  
  return changes;
};

export const analyzeBreakingChangesFromDiff = (diff: string): BreakingChange[] => {
  const changes: BreakingChange[] = [];
  const fileChunks = diff.split(/^diff --git/m).filter(Boolean);
  
  for (const chunk of fileChunks) {
    const fileMatch = chunk.match(/a\/(.+?)\s+b\/(.+)/);
    if (!fileMatch) continue;
    
    const fileName = fileMatch[2];
    if (!fileName.match(/\.(ts|tsx|js|jsx)$/)) continue;
    
    const oldLines: string[] = [];
    const newLines: string[] = [];
    
    for (const line of chunk.split('\n')) {
      if (line.startsWith('-') && !line.startsWith('---')) {
        oldLines.push(line.slice(1));
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        newLines.push(line.slice(1));
      }
    }
    
    if (oldLines.length > 0 && newLines.length > 0) {
      const oldCode = oldLines.join('\n');
      const newCode = newLines.join('\n');
      changes.push(...detectBreakingChanges(oldCode, newCode, fileName));
    }
  }
  
  return changes;
};

export const generateBreakingChangeReport = (changes: BreakingChange[]): string => {
  if (changes.length === 0) return '';
  
  let report = '\n=== BREAKING CHANGE ANALYSIS ===\n';
  report += `Found ${changes.length} potential breaking change(s)\n\n`;
  
  const bySeverity = {
    CRITICAL: changes.filter(c => c.severity === 'CRITICAL'),
    HIGH: changes.filter(c => c.severity === 'HIGH'),
    MEDIUM: changes.filter(c => c.severity === 'MEDIUM'),
    LOW: changes.filter(c => c.severity === 'LOW'),
  };
  
  for (const [severity, items] of Object.entries(bySeverity)) {
    if (items.length === 0) continue;
    
    report += `\n🔴 ${severity} SEVERITY (${items.length}):\n`;
    for (const change of items) {
      report += `\n  [${change.type}] ${change.file_name}\n`;
      report += `    ${change.description}\n`;
      report += `    Impact: ${change.impact}\n`;
      report += `    Migration: ${change.migration_path}\n`;
      report += `    Semver: ${change.semver_impact}\n`;
    }
  }
  
  return report;
};
