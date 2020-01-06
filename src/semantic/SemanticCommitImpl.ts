import { Authored, CommitStat, FileStat } from '../git';
import { SemanticCommit, SemanticMessage } from './SemanticCommit';


export class SemanticCommitImpl implements SemanticCommit {
  constructor(
    public readonly hash: string,
    public readonly tree: string,
    public readonly message: string,
    public readonly semanticMessage: SemanticMessage,
    public readonly gitTags: string,
    public readonly author: Authored,
    public readonly committer: Authored,
    public readonly stats: CommitStat,
    public readonly files: Record<string, FileStat>,) {}

  isFixingSomething(): boolean {
    return this.semanticMessage.type === 'fix'
      || this.semanticMessage.revert != null
      || this.semanticMessage.references.length > 0;
  }

}
