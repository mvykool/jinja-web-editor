import { type Completion } from "@codemirror/autocomplete";

export interface JinjaContext {
  type: 'none' | 'partial' | 'statement' | 'expression' | 'comment' | 'property_access';
  prefix: string;
  hasClosing?: boolean;
  objectPath?: string;
  replaceStart?: number;
  replaceEnd?: number;
}

export interface JinjaBlock {
  type: 'expression' | 'statement' | 'comment';
  start: number;
  end: number;
  content: string;
  opener: string;
  closer?: string;
}

export interface StackTag {
  tag: string;
  position: number;
  fullContent: string;
}

export interface TypoPattern {
  typo: string;
  correct: string;
}

export interface MixedDelimiterPattern {
  regex: RegExp;
  message: string;
}

export interface BracketPair {
  open: string;
  close: string;
  name: string;
}

export { type Completion };