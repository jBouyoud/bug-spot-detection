import { Commit } from '../git';

export type SemanticType = string | null;
export type Note = {
  title: string;
  text: string;
};
export type Reference = {
  action: string;
  owner?: string;
  repository?: string;
  issue?: string;
  raw: string;
  prefix?: string;
};

export type MergeReference = {
  id: string;
  source: string;
};
export type RevertReference = {
  header: string,
  hash: string
};

export interface SemanticMessage {
  header: string;
  type: SemanticType;
  scope: string | null;
  subject: string | null;

  body: string | null;
  footer: string | null;

  notes: Note[];
  references: Reference[];
  mentions: string[];

  merge: MergeReference | null;
  revert: RevertReference | null;
}

export interface SemanticCommit extends Commit {
  semanticMessage: SemanticMessage;

  isFixingSomething(): boolean;
}
