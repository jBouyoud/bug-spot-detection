import { SemanticCommit } from '../semantic';


export class BugDetectionModel {

  constructor(public readonly name: string) {
  }

  public async train(commits: Record<string, SemanticCommit> , buggyCommits: Set<string>) {

  }

  public async predict(commit: SemanticCommit): Promise<number> {
    return 0;
  }

  public async save(path: string) {

  }

  public static async load(path: string): Promise<BugDetectionModel> {
    return new BugDetectionModel('');
  }
}
