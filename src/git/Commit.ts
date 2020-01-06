
export interface FileStat {
  insertion: number;
  deletion: number;
}

export type Authored = {
  name: string;
  email: string;
  date: Date;
};

export type CommitStat = {
  changedFiles: number;
  insertion: number;
  deletion: number;
};

export interface Commit {
  hash: string;
  tree: string;
  message: string;
  gitTags: string;
  author: Authored;
  committer: Authored;
  stats: CommitStat;
  files: Record<string, FileStat>;
}
