import { BasePlugin } from './base';

/**
 * 处理 Confluence / SyntaxHighlighter 风格的代码块
 *
 * 典型结构：
 * <div class="conf-macro" data-macro-name="code">
 *   <div class="syntaxhighlighter sh-confluence java">
 *     <table>
 *       <tr>
 *         <td class="code">
 *           <div class="container">
 *             <div class="line number1">...</div>
 *             <div class="line number2">...</div>
 *           </div>
 *         </td>
 *       </tr>
 *     </table>
 *   </div>
 * </div>
 *
 * 需要在 HexoCodeParsePlugin 之前运行，将其转换为 <pre><code> 结构。
 */
export class ConfluenceCodeParsePlugin extends BasePlugin {
  private static LANG_LIST = [
    'java', 'python', 'javascript', 'js', 'typescript', 'ts',
    'csharp', 'cpp', 'c', 'ruby', 'go', 'rust', 'php', 'swift',
    'kotlin', 'scala', 'bash', 'shell', 'sql', 'xml', 'html',
    'css', 'json', 'yaml', 'yml', 'groovy', 'perl', 'powershell',
    'plain', 'text',
  ];

  public parse(cloneDom: HTMLElement): Promise<void> | void {
    // 1. 处理 Confluence code macro
    const confMacros = cloneDom.querySelectorAll('.conf-macro[data-macro-name="code"]');
    Array.from(confMacros).forEach(node => {
      this.processContainer(node as HTMLElement);
    });

    // 2. 处理通用 SyntaxHighlighter 容器（可能不在 conf-macro 内）
    const highlighters = cloneDom.querySelectorAll('.syntaxhighlighter');
    Array.from(highlighters).forEach(node => {
      // 如果已经被上一步处理过（父节点已替换），跳过
      if (!node.parentNode) return;
      this.processContainer(node as HTMLElement);
    });

    // 3. 兜底：table > td.code 内含 div.line 但没有 <pre> 的情况
    const tables = cloneDom.querySelectorAll('table');
    Array.from(tables).forEach(table => {
      if (!table.parentNode) return;
      const codeCell = table.querySelector('td.code');
      if (!codeCell) return;
      const lines = codeCell.querySelectorAll('.line');
      if (lines.length === 0) return;
      if (codeCell.querySelector('pre')) return; // 已有 pre，让 HexoCodeParsePlugin 处理
      const lang = this.detectLanguage(table);
      this.replaceWithPreCode(table, lines, lang);
    });
  }

  private processContainer(container: HTMLElement) {
    const lines = container.querySelectorAll('.line');
    if (lines.length === 0) return;
    const lang = this.detectLanguage(container);
    this.replaceWithPreCode(container, lines, lang);
  }

  private replaceWithPreCode(element: Element, lines: NodeListOf<Element>, lang?: string) {
    const codeText = Array.from(lines)
      .map(line => line.textContent || '')
      .join('\n');

    const pre = document.createElement('pre');
    const code = document.createElement('code');
    if (lang && lang !== 'plain' && lang !== 'text') {
      code.className = `language-${lang}`;
    }
    code.textContent = codeText;
    pre.appendChild(code);

    element.parentNode?.replaceChild(pre, element);
  }

  private detectLanguage(container: HTMLElement): string | undefined {
    const classList = container.className || '';
    // SyntaxHighlighter 使用类名如 "sh-confluence java"
    for (const lang of ConfluenceCodeParsePlugin.LANG_LIST) {
      if (new RegExp(`\\b${lang}\\b`, 'i').test(classList)) {
        return lang;
      }
    }
    // 向下查找子元素的 class
    const inner = container.querySelector('.syntaxhighlighter');
    if (inner) {
      const innerClass = inner.className || '';
      for (const lang of ConfluenceCodeParsePlugin.LANG_LIST) {
        if (new RegExp(`\\b${lang}\\b`, 'i').test(innerClass)) {
          return lang;
        }
      }
    }
    return undefined;
  }
}
