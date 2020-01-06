import { GitOperator } from './git';
import { asSemanticCommits, SemanticCommit } from './semantic';

async function commitHotSpots(hotspots: Map<string, {ratio: number, count: number}>, now: number, commit: SemanticCommit, firstFix: SemanticCommit) {
  let this_commit_diff = now - new Date(commit.committer.date).getTime();
  let last_commit_diff = now - new Date(firstFix.committer.date).getTime();
  let factor = 1 - (this_commit_diff / last_commit_diff);

  let result = new Map(hotspots.entries());

  for await (const filename of Object.keys(commit.files)) {
    if (!result.has(filename)) {
      result.set(filename, { ratio: 0, count: 0 });
    }
    result.set(filename, {
      ratio: result.get(filename)!.ratio +  1 / (1 + Math.exp((-12 * factor) + 12)),
      count: result.get(filename)!.count + 1,
    });
  }
  return result;
}

export async function runHotSpotsDetection(repositoryPath: string) {
  console.log('Starting...');
  try {
    const gitOperator = new GitOperator(repositoryPath);
    const now = new Date().getTime();
    let firstCommit = null;
    let hotspots = new Map<string, {ratio: number, count: number}>();

    let commitNb = 0;
    let fixCommitNb = 0;

    const commits = await asSemanticCommits(gitOperator.getCommits());
    for await (const commit of commits) {
      commitNb++;
      if (commit.isFixingSomething()) {
        fixCommitNb++;
        if (firstCommit === null) {
          firstCommit = commit;
        }
        hotspots = await commitHotSpots(hotspots, now, commit, firstCommit);
      }
    }

    hotspots = new Map([...hotspots.entries()]
      .filter(([k,v]) => v.ratio > 0)
      .sort(([ak,av], [bk, bv]) => bv.ratio - av.ratio));
    console.log(`Analyzing ${commitNb} commits with ${fixCommitNb} fixes`);
    console.log(hotspots);

    console.log('Done');
  } catch (e) {
    console.error(e);
  }
}
