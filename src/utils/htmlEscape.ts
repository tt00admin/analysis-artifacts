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