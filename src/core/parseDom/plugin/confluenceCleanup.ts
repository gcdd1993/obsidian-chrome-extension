import { BasePlugin } from './base';

/**
 * 清理 Confluence 页面特有的 DOM 结构，消除导出时产生的多余空行和空格。
 *
 * 处理内容：
 * 1. 信息/提示/警告宏容器 — 去掉外层 wrapper 和 icon，只保留内容
 * 2. panel 容器（非代码）— 去掉外层 wrapper，只保留内容
 * 3. 空的 <p> / <br> 标签 — 移除纯空白占位元素
 * 4. 装饰性 icon span — 移除 .aui-icon 等
 *
 * 应在 ConfluenceCodeParsePlugin 之前运行。
 */
export class ConfluenceCleanupPlugin extends BasePlugin {
  public parse(cloneDom: HTMLElement): Promise<void> | void {
    // 1. 移除所有 Confluence 装饰性 icon
    const icons = cloneDom.querySelectorAll(
      '.aui-icon, .confluence-information-macro-icon, .icon',
    );
    Array.from(icons).forEach(icon => icon.parentNode?.removeChild(icon));

    // 2. 展开信息/提示/警告/注意宏容器
    const macros = cloneDom.querySelectorAll(
      [
        '.confluence-information-macro',
        '.confluence-information-macro-information',
        '.confluence-information-macro-note',
        '.confluence-information-macro-warning',
        '.confluence-information-macro-tip',
      ].join(','),
    );
    Array.from(macros).forEach(macro => {
      const body = macro.querySelector('.confluence-information-macro-body');
      if (body) {
        // 用 body 的子节点替换整个宏容器
        this.unwrapElement(body as HTMLElement);
      }
      // 如果整个宏还在 DOM 中（body 为空或不存在），展开宏自身
      if (macro.parentNode) {
        this.unwrapElement(macro as HTMLElement);
      }
    });

    // 3. 展开非代码类 panel 容器
    const panels = cloneDom.querySelectorAll('.panel:not(.code)');
    Array.from(panels).forEach(panel => {
      const panelContent = panel.querySelector('.panelContent');
      if (panelContent) {
        this.unwrapElement(panelContent as HTMLElement);
      }
      if (panel.parentNode) {
        this.unwrapElement(panel as HTMLElement);
      }
    });

    // 4. 移除空 <p> 和纯空白 <p>
    const paragraphs = cloneDom.querySelectorAll('p');
    Array.from(paragraphs).forEach(p => {
      if (this.isEmptyElement(p)) {
        p.parentNode?.removeChild(p);
      }
    });

    // 5. 移除末尾连续 <br>（常见于 Confluence 段落间距）
    const brs = cloneDom.querySelectorAll('br');
    Array.from(brs).forEach(br => {
      const next = br.nextSibling;
      // 如果 <br> 的下一个兄弟也是 <br> 或空文本，移除多余的
      if (
        next &&
        ((next.nodeType === Node.ELEMENT_NODE && (next as Element).tagName === 'BR') ||
          (next.nodeType === Node.TEXT_NODE && !next.textContent?.trim()))
      ) {
        br.parentNode?.removeChild(br);
      }
    });
  }

  /**
   * 将元素替换为其所有子节点（展开 / unwrap）
   */
  private unwrapElement(element: HTMLElement) {
    const parent = element.parentNode;
    if (!parent) return;
    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }
    parent.removeChild(element);
  }

  /**
   * 判断元素是否为空（只含空白文本或 &nbsp; 或仅有 <br>）
   */
  private isEmptyElement(el: HTMLElement): boolean {
    // 没有子节点
    if (!el.childNodes.length) return true;
    // 检查 innerHTML 去除 &nbsp; 和空白后是否为空
    const text = el.innerHTML
      .replace(/&nbsp;/gi, '')
      .replace(/<br\s*\/?>/gi, '')
      .replace(/\u00a0/g, '')
      .trim();
    return text.length === 0;
  }
}
