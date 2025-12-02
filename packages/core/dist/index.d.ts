export * from './llmstxt';
export * from './robots';
export * from './types';
import { ValidationResult, ValidationOptions } from './types';
export declare function validate(url: string, options: ValidationOptions): Promise<ValidationResult>;
