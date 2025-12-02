export interface ValidationOptions {
  depth?: number;
  checkExternalLinks?: boolean;
  onProgress?: (message: string) => void;
}

export interface CheckResult {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'error';
  message?: string;
  details?: any;
}

export interface ValidationResult {
  url: string;
  score: number;
  checks: CheckResult[];
}
