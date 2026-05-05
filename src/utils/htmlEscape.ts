/**
 * HTMLエスケープユーティリティ
 * ユーザー入力やコンテンツを表示する際に、XSS攻撃を防止するためのエスケープ処理を行う
 */

/**
 * HTML特殊文字をエスケープする
 * @param text エスケープ対象の文字列
 * @returns エスケープされた文字列
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '\u0026')
    .replace(/</g, '\u003C')
    .replace(/>/g, '\u003E')
    .replace(/"/g, '\u0022')
    .replace(/'/g, '\u0027');
}

/**
 * HTML特殊文字をデコードする（アンエスケープ）
 * @param text アンエスケープ対象の文字列
 * @returns アンエスケープされた文字列
 */
export function unescapeHtml(text: string): string {
  return text
    .replace(/\u0026amp;/gi, '\u0026')
    .replace(/\u0026lt;/gi, '\u003C')
    .replace(/\u0026gt;/gi, '\u003E')
    .replace(/\u0026quot;/gi, '\u0022')
    .replace(/\u0026#39;/gi, '\u0027')
    .replace(/\u0026#x27;/gi, '\u0027');
}