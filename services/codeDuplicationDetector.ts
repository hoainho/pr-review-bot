import type { CodeDuplication } from '../types';

interface CodeBlock {
  content: string;
  normalized: string;
  file: string;
  startLine: number;
  endLine: number;
  hash: string;
}

const normalizeCode = (code: string): string => {
  return code
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/['"`]/g, '"')
    .replace(/\b(const|let|var)\b/g, 'VAR')
    .replace(/\b[a-z_][a-zA-Z0-9_]*\b/g, (match) => {
      if (['if', 'else', 'for', 'while', 'return', 'function', 'class', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'super', 'VAR'].includes(match)) {
        return match;
      }
      return 'ID';
    })
    .trim();
};

const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
};

const levenshteinSimilarity = (a: string, b: string): number => {
  if (a.length === 0) return b.length === 0 ? 1 : 0;
  if (b.length === 0) return 0;
  
  const maxLen = Math.max(a.length, b.length);
  if (maxLen > 1000) {
    const aChunks = a.match(/.{1,100}/g) || [];
    const bChunks = b.match(/.{1,100}/g) || [];
    let matches = 0;
    const minChunks = Math.min(aChunks.length, bChunks.length);
    for (let i = 0; i < minChunks; i++) {
      if (aChunks[i] === bChunks[i]) matches++;
    }
    return matches / Math.max(aChunks.length, bChunks.length);
  }
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const distance = matrix[a.length][b.length];
  return 1 - (distance / maxLen);
};

const extractCodeBlocks = (code: string, fileName: string, minLines = 4): CodeBlock[] => {
  const blocks: CodeBlock[] = [];
  const lines = code.split('\n');
  
  const blockPatterns = [
    { start: /^[\s]*(function|const|let|var)\s+\w+\s*[=(]/m, end: /^[\s]*\}[\s;]*$/m },
    { start: /^[\s]*if\s*\(/m, end: /^[\s]*\}/m },
    { start: /^[\s]*for\s*\(/m, end: /^[\s]*\}/m },
    { start: /^[\s]*while\s*\(/m, end: /^[\s]*\}/m },
    { start: /^[\s]*switch\s*\(/m, end: /^[\s]*\}/m },
    { start: /^[\s]*try\s*\{/m, end: /^[\s]*\}[\s]*catch/m },
    { start: /^[\s]*class\s+\w+/m, end: /^[\s]*\}/m },
  ];
  
  let i = 0;
  while (i < lines.length) {
    const currentLine = lines[i];
    
    for (const pattern of blockPatterns) {
      if (pattern.start.test(currentLine)) {
        let braceCount = 0;
        let startLine = i;
        let j = i;
        
        while (j < lines.length) {
          const line = lines[j];
          braceCount += (line.match(/\{/g) || []).length;
          braceCount -= (line.match(/\}/g) || []).length;
          
          if (braceCount === 0 && j > startLine) {
            const blockLines = lines.slice(startLine, j + 1);
            if (blockLines.length >= minLines) {
              const content = blockLines.join('\n');
              const normalized = normalizeCode(content);
              
              if (normalized.length > 50) {
                blocks.push({
                  content,
                  normalized,
                  file: fileName,
                  startLine: startLine + 1,
                  endLine: j + 1,
                  hash: simpleHash(normalized),
                });
              }
            }
            i = j;
            break;
          }
          j++;
        }
        break;
      }
    }
    i++;
  }
  
  return blocks;
};

const findDuplicates = (blocks: CodeBlock[], threshold = 0.8): Map<string, CodeBlock[]> => {
  const duplicateGroups = new Map<string, CodeBlock[]>();
  const processed = new Set<number>();
  
  for (let i = 0; i < blocks.length; i++) {
    if (processed.has(i)) continue;
    
    const group: CodeBlock[] = [blocks[i]];
    
    for (let j = i + 1; j < blocks.length; j++) {
      if (processed.has(j)) continue;
      
      if (blocks[i].hash === blocks[j].hash) {
        const similarity = levenshteinSimilarity(blocks[i].normalized, blocks[j].normalized);
        if (similarity >= threshold) {
          group.push(blocks[j]);
          processed.add(j);
        }
      } else if (Math.abs(blocks[i].normalized.length - blocks[j].normalized.length) < blocks[i].normalized.length * 0.3) {
        const similarity = levenshteinSimilarity(blocks[i].normalized, blocks[j].normalized);
        if (similarity >= threshold) {
          group.push(blocks[j]);
          processed.add(j);
        }
      }
    }
    
    if (group.length > 1) {
      const key = `dup_${i}_${simpleHash(blocks[i].normalized)}`;
      duplicateGroups.set(key, group);
    }
    
    processed.add(i);
  }
  
  return duplicateGroups;
};

const generateExtractedFunction = (block: CodeBlock): string => {
  const lines = block.content.split('\n');
  const firstLine = lines[0].trim();
  
  let functionName = 'extractedFunction';
  const funcMatch = firstLine.match(/(?:function|const|let)\s+(\w+)/);
  if (funcMatch) {
    functionName = `shared${funcMatch[1].charAt(0).toUpperCase()}${funcMatch[1].slice(1)}`;
  }
  
  const params: string[] = [];
  const varPattern = /\b(props|data|item|value|result|options|config)\b/g;
  let match;
  while ((match = varPattern.exec(block.content)) !== null) {
    if (!params.includes(match[1])) {
      params.push(match[1]);
    }
  }
  
  return `function ${functionName}(${params.join(', ')}) {
  ${block.content.split('\n').map(l => '  ' + l).join('\n')}
}`;
};

export const detectCodeDuplication = (
  files: Map<string, string>,
  minLines = 4,
  threshold = 0.8
): CodeDuplication[] => {
  const allBlocks: CodeBlock[] = [];
  
  for (const [fileName, content] of files) {
    if (!fileName.match(/\.(ts|tsx|js|jsx)$/)) continue;
    allBlocks.push(...extractCodeBlocks(content, fileName, minLines));
  }
  
  const duplicateGroups = findDuplicates(allBlocks, threshold);
  const duplications: CodeDuplication[] = [];
  
  for (const [key, group] of duplicateGroups) {
    const avgSimilarity = group.length > 1 
      ? group.reduce((sum, block, i) => {
          if (i === 0) return sum;
          return sum + levenshteinSimilarity(group[0].normalized, block.normalized);
        }, 0) / (group.length - 1)
      : 1;
    
    duplications.push({
      duplicate_id: key,
      occurrences: group.map(block => ({
        file_name: block.file,
        line_numbers: `${block.startLine}-${block.endLine}`,
        snippet: block.content.slice(0, 200) + (block.content.length > 200 ? '...' : ''),
      })),
      similarity_score: Math.round(avgSimilarity * 100),
      description: `Found ${group.length} similar code blocks (${Math.round(avgSimilarity * 100)}% similarity)`,
      suggestion: `Extract common logic into a shared function to reduce duplication`,
      extracted_function: generateExtractedFunction(group[0]),
    });
  }
  
  return duplications.sort((a, b) => b.similarity_score - a.similarity_score);
};

export const analyzeDiffForDuplication = (diff: string): CodeDuplication[] => {
  const files = new Map<string, string>();
  let currentFile = '';
  const fileContents = new Map<string, string[]>();
  
  for (const line of diff.split('\n')) {
    const fileMatch = line.match(/^\+\+\+\s+(?:b\/)?(.+)$/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      fileContents.set(currentFile, []);
      continue;
    }
    
    if (currentFile && line.startsWith('+') && !line.startsWith('+++')) {
      fileContents.get(currentFile)?.push(line.slice(1));
    }
  }
  
  for (const [fileName, lines] of fileContents) {
    files.set(fileName, lines.join('\n'));
  }
  
  return detectCodeDuplication(files);
};

export const generateDuplicationReport = (duplications: CodeDuplication[]): string => {
  if (duplications.length === 0) return '';
  
  let report = '\n=== CODE DUPLICATION ANALYSIS ===\n';
  report += `Found ${duplications.length} duplication pattern(s)\n\n`;
  
  for (const dup of duplications.slice(0, 10)) {
    report += `\n📋 ${dup.duplicate_id} (${dup.similarity_score}% similar)\n`;
    report += `   Occurrences: ${dup.occurrences.length}\n`;
    for (const occ of dup.occurrences) {
      report += `   - ${occ.file_name}:${occ.line_numbers}\n`;
    }
    report += `   Suggestion: ${dup.suggestion}\n`;
  }
  
  return report;
};
