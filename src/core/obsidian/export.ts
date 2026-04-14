import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

import type { IClipConfig } from '@/core/configManager/clip';

export const DEFAULT_OBSIDIAN_API_URL = 'https://127.0.0.1:27124';
export const DEFAULT_OBSIDIAN_EXPORT_DIR = 'Yuque Export';

interface IExportToObsidianParams {
  config: IClipConfig;
  exportDir?: string;
  html: string;
  sourceUrl?: string;
  tags?: string[];
  title: string;
}

interface ILakeCardData {
  checked?: boolean;
  detail?: {
    title?: string;
    url?: string;
  };
  downloadUrl?: string;
  filename?: string;
  href?: string;
  name?: string;
  originSrc?: string;
  src?: string;
  text?: string;
  title?: string;
  url?: string;
}

type ITurndownLike = {
  turndown: (input: string) => string;
};

function normalizeApiUrl(url?: string) {
  return (url || DEFAULT_OBSIDIAN_API_URL).trim().replace(/\/+$/, '');
}

function escapeYaml(value?: string) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ');
}

function sanitizePathSegment(value?: string) {
  const sanitized = String(value || '')
    .replace(/[\\:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return sanitized || '未命名';
}

function splitPath(path?: string) {
  return String(path || DEFAULT_OBSIDIAN_EXPORT_DIR)
    .split('/')
    .map(item => sanitizePathSegment(item))
    .filter(Boolean);
}

function createTimestamp() {
  const now = new Date();
  const pad = (value: number) => {
    const stringValue = `${value}`;
    return stringValue.length < 2 ? `0${stringValue}` : stringValue;
  };
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

function decodeLakeCardData(value?: string | null): ILakeCardData | null {
  if (!value) {
    return null;
  }
  const rawValue = value.startsWith('data:') ? value.slice(5) : value;
  try {
    return JSON.parse(decodeURIComponent(rawValue));
  } catch (_error) {
    return null;
  }
}

function normalizeTableCellValue(value: string) {
  const normalized = value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n+/g, '<br>')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();

  return normalized || ' ';
}

function renderTableCell(service: ITurndownLike, cell: Element) {
  const content = service.turndown((cell as HTMLElement).innerHTML || '').trim();
  return normalizeTableCellValue(content || cell.textContent || '');
}

function convertTableToMarkdown(service: ITurndownLike, node: HTMLElement) {
  const rows = Array.from(node.querySelectorAll('tr'))
    .map(row => Array.from(row.children).filter(cell => cell.nodeName === 'TH' || cell.nodeName === 'TD'))
    .filter(row => row.length);

  if (!rows.length) {
    return '';
  }

  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const fillRow = (row: Element[]) => {
    const cells = row.map(cell => renderTableCell(service, cell));
    while (cells.length < columnCount) {
      cells.push(' ');
    }
    return cells;
  };

  const header = fillRow(rows[0]);
  const bodyRows = rows.slice(1).map(fillRow);
  const separator = Array.from({ length: columnCount }, () => '---');
  const toLine = (cells: string[]) => `| ${cells.join(' | ')} |`;

  return ['', '', toLine(header), toLine(separator), ...bodyRows.map(toLine), '', ''].join('\n');
}

function createTurndownService() {
  const service = new TurndownService({
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    headingStyle: 'atx',
    strongDelimiter: '**',
  });

  service.use(gfm);

  service.addRule('table', {
    filter(node: HTMLElement) {
      return node.nodeName === 'TABLE';
    },
    replacement(_content: string, node: HTMLElement) {
      return convertTableToMarkdown(service, node);
    },
  });

  service.addRule('lake-card', {
    filter(node: HTMLElement) {
      return node.nodeName === 'CARD';
    },
    replacement(content: string, node: HTMLElement) {
      const name = node.getAttribute('name');
      const data = decodeLakeCardData(node.getAttribute('value'));

      switch (name) {
        case 'image':
        case 'board': {
          const src = data?.src || data?.originSrc || data?.url;
          return src ? `\n\n![](${src})\n\n` : '\n\n';
        }
        case 'bookmarklink': {
          const url = data?.url || data?.href || data?.detail?.url;
          const title = data?.title || data?.detail?.title || url || '链接';
          return url ? `\n\n[${title}](${url})\n\n` : `\n\n${title}\n\n`;
        }
        case 'file':
        case 'localdoc': {
          const url = data?.downloadUrl || data?.url || data?.src;
          const title = data?.filename || data?.name || data?.title || url || '附件';
          return url ? `\n\n[${title}](${url})\n\n` : `\n\n${title}\n\n`;
        }
        case 'checkbox': {
          const checked = !!data?.checked;
          const text = (content || data?.text || '').trim();
          return `\n- [${checked ? 'x' : ' '}] ${text}`.replace(/\s+$/, '');
        }
        default:
          return content ? `\n\n${content}\n\n` : '\n\n';
      }
    },
  });

  return service;
}

function convertHtmlToMarkdown(html: string) {
  const service = createTurndownService();
  return service
    .turndown(html || '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function encodeVaultPath(path: string) {
  return path
    .split('/')
    .map(item => encodeURIComponent(item))
    .join('/');
}

function buildFilePath(title: string, config: IClipConfig, exportDir?: string) {
  const dir = exportDir !== undefined ? exportDir : config.obsidianExportDir;
  const pathSegments = splitPath(dir);
  pathSegments.push(`${sanitizePathSegment(title)}-${createTimestamp()}.md`);
  return pathSegments.join('/');
}

function buildFrontmatter(params: {
  sourceUrl?: string;
  tags?: string[];
  title: string;
}) {
  const lines = [
    '---',
    `标题: "${escapeYaml(params.title)}"`,
    `链接: "${escapeYaml(params.sourceUrl)}"`,
  ];

  if (params.tags?.length) {
    lines.push('tags:');
    params.tags
      .filter(Boolean)
      .forEach(tag => lines.push(`  - "${escapeYaml(tag)}"`));
  }

  lines.push('---');
  return lines.join('\n');
}

function buildMarkdown(params: IExportToObsidianParams) {
  const body = convertHtmlToMarkdown(params.html);
  const frontmatter = buildFrontmatter(params);
  const sections = [frontmatter];

  if (body) {
    sections.push(body);
  }

  return `${sections.join('\n').trim()}`;
}

async function writeToObsidian(filePath: string, content: string, config: IClipConfig) {
  const apiUrl = normalizeApiUrl(config.obsidianApiUrl);
  const apiKey = config.obsidianApiKey?.trim();

  if (!apiKey) {
    throw new Error('请先在设置中填写 Obsidian API Key');
  }

  const response = await fetch(`${apiUrl}/vault/${encodeVaultPath(filePath)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'text/markdown; charset=UTF-8',
    },
    body: content,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Obsidian 写入失败: ${response.status} ${response.statusText} ${text}`.trim());
  }
}

export async function exportHtmlToObsidian(params: IExportToObsidianParams) {
  const title = sanitizePathSegment(params.title);
  const markdown = buildMarkdown({
    ...params,
    title,
  });
  const filePath = buildFilePath(title, params.config, params.exportDir);
  await writeToObsidian(filePath, markdown, params.config);
  return {
    filePath,
    markdown,
  };
}

export async function listObsidianFolders(config: IClipConfig): Promise<string[]> {
  const apiUrl = normalizeApiUrl(config.obsidianApiUrl);
  const apiKey = config.obsidianApiKey?.trim();
  if (!apiKey) {
    throw new Error('No API key configured');
  }
  const response = await fetch(`${apiUrl}/vault/`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  return (data.files as string[])
    .filter((f: string) => f.endsWith('/'))
    .map((f: string) => f.replace(/\/$/, ''))
    .sort();
}
