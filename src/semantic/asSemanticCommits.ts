import { sync as parseSemanticCommit } from 'conventional-commits-parser';
import { Commit } from '../git';
import { SemanticCommit } from './SemanticCommit';
import { SemanticCommitImpl } from './SemanticCommitImpl';

export async function* asSemanticCommits(commits: AsyncIterableIterator<Commit>): AsyncIterableIterator<SemanticCommit> {
  for await (const commit of commits) {
    yield new SemanticCommitImpl(
      commit.hash, commit.tree, commit.message,
      parseSemanticCommit(commit.message, {}), commit.gitTags,
      commit.author, commit.committer, commit.stats, commit.files);
  }
}
