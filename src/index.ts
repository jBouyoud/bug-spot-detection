import { isObject } from 'lodash';
import { GitOperator } from './git';
import { runHotSpotsDetection } from './hotspots';
import { asSemanticCommits } from './semantic';
import { RandomForestClassifier } from 'random-forest-classifier';
import fs from 'fs';

type Meta = Record<string, any>;
type FlattenOptions = {
  maxDepth: number | null;
  depth: number;
  prefix: string;
};

function flatten(
  meta: Meta,
  maxDepth: number | null = null,
): Meta {
  const result = {};
  flattenIterator(meta, result, { depth: 0, prefix: '', maxDepth });
  return result;
}

function flattenIterator(meta: Meta, result: Meta, options: FlattenOptions) {
  for (const key of Object.keys(meta)) {
    const prefixedKey = `${options.prefix}.${key}`;
    const value = meta[key];

    if (isObject(value) && canDive(options.depth, options.maxDepth)) {
      flattenIterator(value, result, {
        depth: options.depth + 1,
        maxDepth: options.maxDepth,
        prefix: prefixedKey,
      });
      continue;
    }
    // eslint-disable-next-line no-param-reassign
    result[prefixedKey] = value;
  }
}

function canDive(current: number, max: number | null) {
  return max === null || current + 1 < max;
}

export async function train(repositoryPath: string) {
  try {
    const model = new RandomForestClassifier({
      n_estimators: 20
    });
    const gitOperator = new GitOperator(repositoryPath);
    const features: Record<string, Record<string, any>> = {};
    const buggyCommits = new Set<string>([]);

    const commitsIterator = await asSemanticCommits(gitOperator.getCommits());
    for await (const commit of commitsIterator) {
      if (commit.isFixingSomething()) {
        // get the last commit to modify those lines
        const blamedCommits = await gitOperator.findBlameCommits(commit);
        for (const buggyCommit of blamedCommits.keys()) {
          buggyCommits.add(buggyCommit);
        }
      }
      const data =flatten(commit);
      data['buggy_commit'] = 0;
      features[commit.hash] = data;
    }

    for (const buggyCommit of buggyCommits.keys()){
      if(!(buggyCommit in features)) {
        throw new Error(`Buggy commit ${buggyCommit} not found`);
      }
      features[buggyCommit]['buggy_commit'] = 1;
    }

    const trees = await new Promise(((resolve, reject) => {
      model.fit(Object.values(features), null, 'buggy_commit', (err: any, trees: any) => {
        if (err) {
          reject(err);
        }
        resolve(trees);
      });
    }));

    fs.writeFileSync('./bugspot.model', JSON.stringify(trees));

    console.log(`[${repositoryPath}] Analyzing ${Object.keys(features).length} commits, found ${buggyCommits.size} buggy commits`);

    return { model, trees };
  } catch (e) {
    console.error(e);
    throw e;
  }
}

async function predict(modelAndTrees: any, repositoryPath: string, commitHash: string) {
  try {
    const gitOperator = new GitOperator(repositoryPath);
    let commitToPredict = null;

    const commitsIterator = await asSemanticCommits(gitOperator.getCommits());
    for await (const commit of commitsIterator) {
      if(commit.hash.indexOf(commitHash) === 0) {
        commitToPredict = commit;
      }
    }

    if(commitToPredict === null) {
      throw new Error(`No commit [${commitHash}] found`);
    }
    const data = flatten(commitToPredict);
    console.log(data);
    //const trainedModel = JSON.parse(fs.readFileSync('./bugspot.model').toString());

    const res = modelAndTrees.model.predict(data, modelAndTrees.trees);
    console.log(res);
    return res[0];
  } catch (e) {
    console.error(e);
    throw e;
  }
}


(async () => {
  const model = await train('/Users/jbouyoud/workspace/bridge-api-indexer');

  const commits = [
    '07100219',
    '19729645',
  ];
  for (const commit of commits) {
    const prediction = await predict(model, '/Users/jbouyoud/workspace/bridge-api-indexer', commit);
    console.log(`Bug prediction for commit [${commit}] is [${prediction}]`);
  }

  //await run('/Users/jbouyoud/workspace/bridge-api-pm');
  //await run('/Users/jbouyoud/workspace/bridge-api-bauges');
  if (void 0 === true) {
    await runHotSpotsDetection('/Users/jbouyoud/workspace/bridge-api-indexer');
  }
})();
