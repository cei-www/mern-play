/** Small text helpers. Zone code works on LF text and restores the file's original line endings. */

export const toLf = (s: string): string => s.replace(/\r\n/g, '\n');

export const hasCrlf = (s: string): boolean => s.includes('\r\n');

export const fromLf = (s: string, crlf: boolean): string => (crlf ? s.replace(/\n/g, '\r\n') : s);
