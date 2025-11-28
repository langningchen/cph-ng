// Copyright (C) 2025 Langning Chen
//
// This file is part of cph-ng.
//
// cph-ng is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// cph-ng is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with cph-ng.  If not, see <https://www.gnu.org/licenses/>.

const process = async () => {
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return 'No workspace folder found';
  }
  const folder = workspaceFolders[0].path;
  // const folder = await ui.chooseFolder();

  const ext = 'cpp';
  const results = [];
  logger.debug('Default script started', { problems });
  for (const problem of problems) {
    try {
      const { name, url } = problem;
      logger.debug('Generating filename', { name, url });

      let filename = null;
      if (url) {
        try {
          const u = new URL(url);
          const isHost = (host) =>
            u.hostname === host || u.hostname.endsWith(`.${host}`);
          if (isHost('codeforces.com')) {
            const regexPatterns = [
              /\/contest\/(\d+)\/problem\/(\w+)/,
              /\/problemset\/problem\/(\d+)\/(\w+)/,
              /\/gym\/(\d+)\/problem\/(\w+)/,
            ];
            for (const regex of regexPatterns) {
              const match = url.match(regex);
              if (match) {
                filename = `${match[1]}${match[2]}.${ext}`;
                logger.info('Detected Codeforces URL, generating filename', {
                  url,
                  filename,
                });
                break;
              }
            }
          }
          if (!filename && isHost('luogu.com.cn')) {
            const match = url.match(/problem\/(\w+)/);
            if (match) {
              filename = `${match[1]}.${ext}`;
              logger.info('Detected Luogu URL, generating filename', {
                url,
                filename,
              });
            }
          }
          if (!filename && isHost('atcoder.jp')) {
            const match = url.match(/tasks\/(\w+)_(\w+)/);
            if (match) {
              filename = `${match[1]}${match[2]}.${ext}`;
              logger.info('Detected AtCoder URL, generating filename', {
                url,
                filename,
              });
            }
          }
        } catch (e) {
          logger.error('URL Parsing error:', e.message);
        }
      }

      if (!filename) {
        const words = name.match(/[\p{L}]+|[0-9]+/gu);
        const base = words
          ? `${words.join('_')}`
          : `${name.replace(/\W+/g, '_')}`;
        filename = `${base}.${ext}`;
        logger.info('Falling back to generated name from problem title', {
          name,
          filename,
        });
      }

      logger.debug('Generated filename', { filename });
      results.push(path.join(folder, filename));
    } catch (e) {
      logger.error(
        'Error generating filename for problem',
        e && e.message ? e.message : e,
      );
      results.push(null);
    }
  }

  logger.debug('Default script finished', { results });
  return results;
};
