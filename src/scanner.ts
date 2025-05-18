import * as vscode from 'vscode';
import * as path from 'path';
import { getComponentName } from './utils';

interface HardcodedText {
    text: string;
    start: number;
    end: number;
}

/**
 * Scans an Angular HTML template or TS file for hardcoded text
 */
export async function scanForHardcodedText(document: vscode.TextDocument): Promise<HardcodedText[]> {
    const content = document.getText();
    const results: HardcodedText[] = [];
    
    if (document.languageId === 'html') {
        // Scan HTML template
        results.push(...scanHtmlContent(content));
    } else if (document.languageId === 'typescript') {
        // Scan TS file
        results.push(...scanTypeScriptContent(content));
    }
    
    return results;
}

/**
 * Scans HTML content for hardcoded text
 */
function scanHtmlContent(content: string): HardcodedText[] {
    const results: HardcodedText[] = [];
    
    // Patterns to ignore (already translated or not needed for translation)
    const ignorePatterns = [
        /\{\{\s*['"](.+?)['"]\s*\|\s*translate\s*\}\}/g, // {{ 'key' | translate }}
        /\[innerHTML\]\s*=\s*"['"](.+?)['"]\s*\|\s*translate"/g, // [innerHTML]="'key' | translate"
        /<[^>]*\[([^\]]+)\]="[^"]*\|\s*translate[^"]*"[^>]*>/g, // Any attribute binding with translate pipe
        /<[^>]*translate="[^"]*"[^>]*>/g, // translate directive
        /<[^>]*\[translateParams\]="[^"]*"[^>]*>/g, // translateParams directive
    ];
    
    // First, we mark positions to ignore (already localized text)
    const ignoredPositions: {start: number, end: number}[] = [];
    
    for (const pattern of ignorePatterns) {
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(content)) !== null) {
            ignoredPositions.push({
                start: match.index,
                end: match.index + match[0].length
            });
        }
    }
    
    // Function to check if a position is inside a range to ignore
    const shouldIgnore = (start: number, end: number): boolean => {
        return ignoredPositions.some(pos => 
            (start >= pos.start && start <= pos.end) || 
            (end >= pos.start && end <= pos.end) ||
            (start <= pos.start && end >= pos.end)
        );
    };
    
    // Find text between tags that isn't inside translation construct
    const textNodePattern = />([^<]+)</g;
    let match: RegExpExecArray | null;
    
    while ((match = textNodePattern.exec(content)) !== null) {
        const text = match[1].trim();
        if (text && text.length > 1 && !/^[\s\d.,:;!?%]+$/.test(text)) {
            const start = match.index + 1;
            const end = start + match[1].length;
            
            if (!shouldIgnore(start, end)) {
                results.push({ text, start, end });
            }
        }
    }
    
    // Find attribute values that likely need translation
    const translateableAttributes = ['placeholder', 'title', 'alt', 'aria-label'];
    
    for (const attr of translateableAttributes) {
        const attrPattern = new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, 'g');
        
        while ((match = attrPattern.exec(content)) !== null) {
            const text = match[1].trim();
            if (text && text.length > 1 && !/^[\s\d.,:;!?%]+$/.test(text)) {
                const start = match.index + match[0].indexOf(text);
                const end = start + text.length;
                
                if (!shouldIgnore(start, end)) {
                    results.push({ text, start, end });
                }
            }
        }
    }
    
    return results;
}

/**
 * Scans TypeScript content for hardcoded text
 */
function scanTypeScriptContent(content: string): HardcodedText[] {
    const results: HardcodedText[] = [];
    
    // Patterns to ignore
    const ignorePatterns = [
        /this\.translate\.instant\(\s*['"](.+?)['"]\s*(\)|,)/g, // this.translate.instant('key')
        /translate\.instant\(\s*['"](.+?)['"]\s*(\)|,)/g, // translate.instant('key')
        /i18n\.\w+\(\s*['"](.+?)['"]\s*(\)|,)/g, // i18n.get('key')
    ];
    
    // Mark positions to ignore
    const ignoredPositions: {start: number, end: number}[] = [];
    
    for (const pattern of ignorePatterns) {
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(content)) !== null) {
            ignoredPositions.push({
                start: match.index,
                end: match.index + match[0].length
            });
        }
    }
    
    // Function to check if a position is inside a range to ignore
    const shouldIgnore = (start: number, end: number): boolean => {
        return ignoredPositions.some(pos => 
            (start >= pos.start && start <= pos.end) || 
            (end >= pos.start && end <= pos.end) ||
            (start <= pos.start && end >= pos.end)
        );
    };
    
    // Find string literals in TypeScript
    // This is a simple approach and might have false positives
    const stringLiteralPattern = /(['"])((?:(?!\1)[^\\]|\\[\s\S])*?)\1/g;
    let match: RegExpExecArray | null;
    
    while ((match = stringLiteralPattern.exec(content)) !== null) {
        const quote = match[1]; // ' or "
        const text = match[2];
        
        // Skip if it's likely not a UI string (e.g., imports, variable names, etc.)
        // This is a heuristic and can be improved
        if (text && text.length > 1 && !/^[\s\d.,:;!?%]+$/.test(text) && 
            !text.includes('.') && !text.includes('/') && !text.includes('\\')) {
            
            // Check context to see if this is likely a UI string
            const lineStart = content.lastIndexOf('\n', match.index) + 1;
            const lineEnd = content.indexOf('\n', match.index);
            const line = content.substring(lineStart, lineEnd !== -1 ? lineEnd : content.length);
            
            // Skip if it's likely part of an import, define, etc.
            if (!line.includes('import ') && !line.includes('from ') && 
                !line.includes('require(') && !line.includes('path.') &&
                !line.match(/\s*private\s+\w+\s*=/) && !line.match(/\s*const\s+\w+\s*=/)) {
                
                const start = match.index + 1; // +1 to skip the opening quote
                const end = start + text.length;
                
                if (!shouldIgnore(start, end)) {
                    results.push({ text, start, end });
                }
            }
        }
    }
    
    return results;
}