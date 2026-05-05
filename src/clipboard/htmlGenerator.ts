import { escapeHtml } from '../utils/htmlEscape.js';

/**
 * HTML生成サービス
 */
export class HtmlGenerator {
  /**
   * DataResource JSONをHTMLテーブルに変換
   */
  dataResourceToHtml(json: string): string {
    try {
      const parsed = JSON.parse(json);
      const fields = parsed.schema?.fields ?? [];
      const rows = Array.isArray(parsed.data) ? parsed.data : [];
      const fieldNames = fields
        .map((field: { name?: string }) => field.name)
        .filter((name: string | undefined): name is string => typeof name === 'string' && name !== 'index');
      const columns: string[] = fieldNames.length > 0
        ? fieldNames
        : Object.keys(rows[0] ?? {}).filter((name) => name !== 'index');

      if (columns.length === 0) {
        return `<pre>${escapeHtml(JSON.stringify(parsed, null, 2))}</pre>`;
      }

      const header = columns.map((column: string) => `<th>${escapeHtml(column)}</th>`).join('');
      const body = rows.map((row: Record<string, unknown>) => {
        const cells = columns.map((column: string) => `<td>${escapeHtml(String(row[column] ?? ''))}</td>`).join('');
        return `<tr>${cells}</tr>`;
      }).join('');

      return `<table class="datadeck-table"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
    } catch {
      return `<pre>${escapeHtml(json)}</pre>`;
    }
  }

  /**
   * JSONデータを整形された文字列に変換
   */
  prettyJson(data: Uint8Array): string {
    const text = Buffer.from(data).toString('utf-8');
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }
}