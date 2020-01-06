import traverse from 'traverse';
import { Readable } from 'stream';
import { execute } from './exec_cmd';
import { Commit, FileStat } from './Commit';

const START = '==START==';
const FIELD = '==FIELD==';
const END = '==END==';

const STAT_MATCHER = /(?<changedFiles>[0-9]+) files? changed,?(\s*(?<insertion>[0-9]+)\s*insertions?\(\+\),?)?(\s*(?<deletion>[0-9]+)\s*deletions?\(\-\))?/;
const FILE_MATCHER = /(?<insertion>[0-9]+)\s*(?<deletion>[0-9]+)\s*(?<filename>.+)/;

const config = {
  hash: 'H',
  tree: 'T',
  author: {
    name: 'an',
    email: 'ae',
    date: {
      key: 'ai',
      type: Date
    }
  },
  committer: {
    name: 'cn',
    email: 'ce',
    date: {
      key: 'ci',
      type: Date
    }
  },
  message: 'B',
  gitTags: 'd',
};

function mapConfig(config: any) {
  return traverse.reduce(config, function (fields: any, node: any) {
    // @ts-ignore
    if (this.isLeaf && typeof node === 'string') {
      // @ts-ignore
      const typed = this.key === 'key';
      fields.push({
        // @ts-ignore
        path: typed ? this.parent.path : this.path,
        key: node,
        // @ts-ignore
        type: this.parent.node.type
      });
    }
    return fields;
  }, []);
}

function formatFieldsMap(fieldMap: any) {
  return '--format=' + START + fieldMap.map((field: any) => '%' + field.key).join(FIELD) + END;
}

async function* splitByCommit(gitLogStream: Readable): AsyncIterableIterator<String> {
  let last: string | undefined = '';

  for await (const gitLogChuck of gitLogStream) {
    const rawStrings: string[] =
      ((last || '') + gitLogChuck.toString('utf8'))
        .split(START)
        .filter((raw: string) => raw != '');

    last = rawStrings.pop();
    for (const rawString of rawStrings) {
      yield rawString;
    }
  }

  if (last) {
    yield last;
  }
}


function parseFileStat(rawFile: string): { filename: string; fileStat: FileStat } | null {
  const matcher = FILE_MATCHER.exec(rawFile);
  if (matcher == null || !matcher.groups) {
    return null;
  }
  const insertion = +matcher.groups.insertion || 0;
  const deletion = +matcher.groups.deletion || 0;

  if (insertion === 0 && deletion === 0) {
    return null;
  }
  return {
    filename: matcher.groups.filename,
    fileStat: {
      insertion,
      deletion,
    }
  };
}

export async function* getCommits(repositoryPath: string): AsyncIterableIterator<Commit> {
  const fieldsMap = mapConfig(config);
  const gitLogRawStream = execute('git', [
    '--no-pager',
    'log',
    '--numstat',
    '--reverse',
    formatFieldsMap(fieldsMap),
  ], {
    cwd: repositoryPath,
    env: { ...process.env },
  });
  const rawCommitStream = splitByCommit(gitLogRawStream);

  for await (const rawCommit of rawCommitStream) {
    const [formatted, unformatted] = rawCommit.trim().split(END);
    const rawFiles = unformatted.split('\n').map(l => l.trim()).filter(l => l != '');
    const stats = rawFiles.pop();

    // Parse formatted part
    const fields = formatted.replace(START, '').trim().split(FIELD);
    const commit = fieldsMap.reduce(function (parsed: any, field: any, index: any) {
      const value = fields[index].trim();
      traverse(parsed).set(field.path, field.type ? new field.type(value) : value);
      return parsed;
    }, {});

    // Parse files
    commit.files = rawFiles
      .reduce((files, rawFile: string) => {
        const res = parseFileStat(rawFile);
        if (res === null) {
          return files;
        }
        files[res.filename] = res.fileStat;
        return files;
      }, {} as Record<string, FileStat>);

    // Parse global stats
    commit.stats = { changedFiles: 0, insertion: 0, deletion: 0 };
    if (stats) {
      const statMatch = STAT_MATCHER.exec(stats);
      if (statMatch != null && statMatch.groups) {
        commit.stats.changedFiles = +statMatch.groups.changedFiles || 0;
        commit.stats.insertion = +statMatch.groups.insertion || 0;
        commit.stats.deletion = +statMatch.groups.deletion || 0;
      } else {
        // no Match
        if(rawFiles.length === 0) {
          const res = parseFileStat(stats);
          if (res !== null) {
            commit.stats.changedFiles = 1;
            commit.stats.insertion = res.fileStat.insertion;
            commit.stats.deletion = res.fileStat.deletion;
            commit.files = { [res.filename]: res.fileStat };
          }
        }
      }
    }

    yield commit;
  }
}

