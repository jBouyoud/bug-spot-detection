import { executeToString } from './exec_cmd';
import { Commit } from './Commit';
import { LineFix } from './LineFix';
import { getCommits } from './log';
import { flatten } from 'lodash';

const FIXED_LINES = /@@ -(?<sourceLine>[0-9]+),?(?<sourceCount>[0-9]+)? \+(?<destLine>[0-9]+),?(?<destCount>[0-9]+)? @@/gm;


export class GitOperator {
  constructor(
    private readonly repository: string,
  ) {
  }

  public getCommits() {
    return getCommits(this.repository);
  }

  public async getFixedLines(commit: Commit): Promise<Record<string, LineFix[]>> {
    const fixedLines: Record<string, LineFix[]> = {};

    const gitDiffPromises = Object.keys(commit.files).map(filename => executeToString(
      'git',
      [
        '--no-pager',
        'diff',
        `${commit.hash}^`,
        `${commit.hash}`,
        '-U0',
        '--',
        filename,
      ],
      {
        cwd: this.repository,
        env: { ...process.env },
      }).then((gitDiff) => ({
        filename, gitDiff
      })
    ));

    const gitDiffs = await Promise.all(gitDiffPromises);

    for (const { filename, gitDiff } of gitDiffs) {
      if (!(filename in fixedLines)) {
        fixedLines[filename] = [];
      }
      let match;
      while ((match = FIXED_LINES.exec(gitDiff)) !== null) {
        fixedLines[filename].push({
          sourceLine: +match.groups!.sourceLine,
          sourceCount: +match.groups!.sourceCount || 1,
          destLine: +match.groups!.destLine,
          destCount: +match.groups!.destCount || 1,
        });
      }
    }
    return fixedLines;
  }

  public async findBlameCommits(commit: Commit, fixedLines: Record<string, LineFix[]> | null = null) {
    let filenameLines = fixedLines;
    if (filenameLines === null) {
      filenameLines = await this.getFixedLines(commit);
    }

    const gitBlamePromises = [];
    for (const filename of Object.keys(filenameLines)) {
      for (const lineFix of filenameLines[filename]) {
        if (lineFix.sourceLine > 0 && lineFix.sourceCount > 0) {
          gitBlamePromises.push(
            executeToString('git', [
              '--no-pager',
              'blame',
              '-l',
              `-L${lineFix.sourceLine},+${lineFix.sourceCount}`,
              `${commit.hash}^`,
              '--',
              filename,
            ], {
              cwd: this.repository,
              env: { ...process.env },
            })
              .then(gitBlame => gitBlame
                .split('\n')
                .map(lines => lines.split(' ')[0])
                .filter(hash => hash != '')
              )
          );
        }
      }
    }
    const gitBlames = await Promise.all(gitBlamePromises);
    return new Set<string>(flatten(gitBlames));
  }
}
