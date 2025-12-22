export interface FileSystemAdapter {
  readAsStringAsync(uri: string, options: { encoding: 'utf8' | 'base64' }): Promise<string>;
}

