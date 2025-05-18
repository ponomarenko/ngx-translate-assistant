import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Settings for the extension
 */
export interface NgxTranslateSettings {
    translationPath: string;
    defaultLang: string;
}

/**
 * Get the component name from a file path
 */
export function getComponentName(filePath: string): string {
    const fileName = path.basename(filePath);
    const match = fileName.match(/(.+)\.component\.(ts|html)$/);
    
    if (match) {
        return match[1];
    }
    
    // Try to infer module/component name from directory structure
    try {
        const dirName = path.basename(path.dirname(filePath));
        // Check if directory name matches a component pattern
        if (dirName.match(/(.+)-component$/) || dirName.match(/(.+)-page$/)) {
            return dirName.split('-')[0];
        }
    } catch (error) {
        // Ignore directory parsing errors
    }
    
    // Fallback: use the file name without extension
    return path.parse(fileName).name;
}

/**
 * Get the workspace settings for the extension
 */
export function getWorkspaceSettings(): NgxTranslateSettings {
    const config = vscode.workspace.getConfiguration('ngxTranslateAssistant');
    
    return {
        translationPath: config.get<string>('translationPath', 'assets/i18n'),
        defaultLang: config.get<string>('defaultLang', 'en')
    };
}

/**
 * Generate a translation key based on component path and text content
 */
export async function generateTranslationKey(componentPath: string, text: string): Promise<string> {
    // Get component name
    const componentName = getComponentName(componentPath);
    
    // Get element type from context clues (button, title, label etc.)
    const elementType = guessElementType(componentPath, text);
    
    // Clean and normalize the text to create a key
    let textKey = text
        .trim()
        .toLowerCase()
        // Keep only alphanumeric characters and spaces
        .replace(/[^\w\s]/g, '')
        // Replace multiple spaces with a single one
        .replace(/\s+/g, ' ')
        // Take first few words
        .split(' ')
        .slice(0, 3)
        .join('_');
    
    // For very long text, create a hash or just use the first few words
    if (textKey.length > 30) {
        textKey = textKey.substring(0, 30);
    }
    
    // Build the final key
    let key = componentName;
    if (elementType) {
        key += `.${elementType}`;
    }
    key += `.${textKey}`;
    
    // Allow the user to customize the key
    const customKey = await vscode.window.showInputBox({
        prompt: 'Enter a translation key or accept the suggested one',
        value: key,
        placeHolder: 'component.section.text'
    });
    
    return customKey || key;
}

/**
 * Try to guess element type from context
 */
function guessElementType(filePath: string, text: string): string {
    // Check file content for context clues
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lineWithText = content.split('\n').find(line => line.includes(text));
        
        if (lineWithText) {
            // Check for common element types
            if (lineWithText.includes('<button') || lineWithText.includes('mat-button')) {
                return 'button';
            } else if (lineWithText.includes('<h1') || lineWithText.includes('<h2')) {
                return 'title';
            } else if (lineWithText.includes('<label') || lineWithText.match(/aria-label/)) {
                return 'label';
            } else if (lineWithText.includes('placeholder=')) {
                return 'placeholder';
            } else if (lineWithText.includes('<p') || text.length > 50) {
                return 'text';
            }
        }
    } catch (error) {
        // Ignore file reading errors
    }
    
    // Try to guess from the text itself
    if (text.length < 20) {
        if (/OK|Cancel|Submit|Save|Delete|Yes|No/i.test(text)) {
            return 'button';
        } else if (/Enter|Type|Fill/i.test(text)) {
            return 'placeholder';
        } else if (/Error|Warning|Info/i.test(text)) {
            return 'message';
        }
    } else if (text.length > 100) {
        return 'paragraph';
    }
    
    return '';
}

/**
 * Sanitize a string to make it suitable for use as a key
 */
export function sanitizeKey(text: string): string {
    return text
        .replace(/[^\w.]/g, '_') // Replace non-word chars except dot with underscore
        .replace(/_+/g, '_')     // Replace multiple underscores with single one
        .replace(/^_|_$/g, '');  // Remove leading and trailing underscores
}

/**
 * Get all translation keys from a translation file
 */
export async function getAllTranslationKeys(
    workspaceFolder: vscode.WorkspaceFolder, 
    settings: NgxTranslateSettings
): Promise<string[]> {
    // Build path to translation file
    const translationFilePath = path.join(
        workspaceFolder.uri.fsPath,
        settings.translationPath,
        `${settings.defaultLang}.json`
    );
    
    if (!fs.existsSync(translationFilePath)) {
        return [];
    }
    
    try {
        const content = fs.readFileSync(translationFilePath, 'utf8');
        const translations = JSON.parse(content);
        
        // Extract all keys using dot notation
        return flattenKeys(translations);
    } catch (error) {
        console.error(`Error reading translation file: ${error}`);
        return [];
    }
}

/**
 * Flatten nested object keys into dot notation
 */
function flattenKeys(obj: any, prefix: string = ''): string[] {
    return Object.keys(obj).reduce((acc: string[], key: string) => {
        const prefixedKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            // Recurse for nested objects
            return [...acc, ...flattenKeys(obj[key], prefixedKey)];
        }
        
        return [...acc, prefixedKey];
    }, []);
}
