import { useWordMarkContext } from '@/components/WordMarkLayout/useWordMarkContext';
import { backgroundBridge } from '@/core/bridge/background';
import { clipConfigManager } from '@/core/configManager/clip';
import { WordMarkOptionTypeEnum } from '@/core/configManager/wordMark';
import { exportHtmlToObsidian } from '@/core/obsidian/export';
import { webProxy } from '@/core/webProxy';
import { useForceUpdate } from '@/hooks/useForceUpdate';
import { MonitorAction } from '@/isomorphic/constant/monitor';
import { useInjectContent } from '@/pages/inject/components/InjectLayout';
import classnames from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Editor, { IEditorRef } from './Editor';
import Inner from './Inner';
import Panel from './Panel';
import styles from './index.module.less';

function WordMarkApp() {
  const [type, setType] = useState<WordMarkOptionTypeEnum | null>(null);
  const [selectText, setSelectText] = useState<string>('');
  const { forceUpdate } = useForceUpdate();
  const showWordMarkRef = useRef(false);
  const editorRef = useRef<IEditorRef>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mouseupPositionRef = useRef({ x: 0, y: 0 });
  const isSaving = useRef(false);
  const wordMarkContext = useWordMarkContext();
  const [visible, setVisible] = useState(false);
  const { message: apiMessage } = useInjectContent();

  const save = useCallback(
    async (text: string) => {
      if (wordMarkContext.evokePanelWhenClip) {
        window._yuque_ext_app.addContentToClipAssistant(text, true);
        showWordMarkRef.current = false;
        forceUpdate();
        return;
      }
      if (isSaving.current) {
        return;
      }
      const clipConfig = await clipConfigManager.get();
      const editor = editorRef.current;
      if (clipConfig.addLink) {
        await editor?.appendContent(
          `<blockquote><p>来自: <a href="${window.location.href}">${document.title}</a></p></blockquote>`,
          true,
        );
      }
      try {
        isSaving.current = true;
        const tab = await backgroundBridge.tab.getCurrent();
        const html = await (editor as any)?.getContent?.('text/html');
        const clipConfig = await clipConfigManager.get();
        const result = await exportHtmlToObsidian({
          config: clipConfig,
          html: html || '',
          savePosition: wordMarkContext.defaultSavePosition,
          sourceUrl: tab?.url || window.location.href,
          title: __i18n('[来自剪藏] {title}', {
            title: tab?.title || document.title || '',
          }),
        });
        apiMessage?.success(`${__i18n('已导出到 Obsidian')}：${result.filePath}`);
        showWordMarkRef.current = false;
        forceUpdate();
      } catch (e: any) {
        apiMessage?.error(e?.message || __i18n('导出失败，请重试！'));
      }
      isSaving.current = false;
    },
    [wordMarkContext],
  );

  const executeCommand = useCallback(
    async (t: WordMarkOptionTypeEnum) => {
      if (t === WordMarkOptionTypeEnum.clipping) {
        // 上报一次划词剪藏
        webProxy.monitor.biz(MonitorAction.wordMarkClip);
        const selection = window.getSelection();
        let html = '';
        if (selection) {
          html = Array.from(selection.getRangeAt(0).cloneContents().childNodes)
            .map((v: any) => v?.outerHTML || v?.nodeValue)
            .join('');
        }
        await editorRef.current?.setContent(`${html}`, 'text/html');
        await save(html);
        return;
      }
      setType(t);
    },
    [selectText, save],
  );

  const initPosition = useCallback(() => {
    const width = wrapperRef.current?.offsetWidth || 0;
    const height = wrapperRef.current?.offsetHeight || 0;
    const left = mouseupPositionRef.current.x - width / 2;
    const top = mouseupPositionRef.current.y + window.scrollY + 26;
    const maxLeft = document.body.clientWidth - width;
    const maxTop = window.innerHeight + window.scrollY - height - 28;
    if (wrapperRef.current) {
      wrapperRef.current.style.left = `${Math.min(Math.max(left, 0), maxLeft)}px`;
      wrapperRef.current.style.top = `${Math.min(Math.max(top, 0), maxTop)}px`;
    }
  }, []);

  const closeWordMark = useCallback(() => {
    showWordMarkRef.current = false;
    forceUpdate();
  }, []);

  useEffect(() => {
    const getIsEditing = () => {
      const element = document.activeElement;
      if (!element) {
        return false;
      }
      if (['INPUT', 'TEXTAREA'].includes(element.tagName)) {
        return true;
      }
      return element.getAttribute('contenteditable') === 'true';
    };

    const onMouseUp = (e: MouseEvent) => {
      setTimeout(() => {
        const isEdit = getIsEditing();
        const selection = window.getSelection();
        // 如果选中区域可编辑，那么不展示划词
        if (isEdit || !selection) {
          showWordMarkRef.current = false;
          setVisible(false);
          forceUpdate();
          return;
        }
        const selectionText = selection.toString();
        if (selection.rangeCount <= 0) {
          showWordMarkRef.current = false;
          setVisible(false);
          forceUpdate();
          return;
        }
        if (!selectionText.trim().length) {
          showWordMarkRef.current = false;
          setVisible(false);
          forceUpdate();
          return;
        }
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const x = (rect.left + rect.right) / 2;
        const y = rect.bottom;
        showWordMarkRef.current = true;
        forceUpdate();
        setSelectText(selectionText);
        mouseupPositionRef.current = {
          x,
          y,
        };
      }, 10);
    };

    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  useEffect(() => {
    setType(null);
  }, [selectText, showWordMarkRef.current]);

  useEffect(() => {
    setVisible(wordMarkContext.enable);
    // 不存在修饰键时不监听键盘事件
    if (!wordMarkContext.evokeWordMarkShortKey) {
      return;
    }
    const onkeydown = (e: KeyboardEvent) => {
      if (e.key === wordMarkContext.evokeWordMarkShortKey && showWordMarkRef.current) {
        setVisible(v => !v);
      }
    };
    window.addEventListener('keydown', onkeydown);

    return () => {
      window.removeEventListener('keydown', onkeydown);
    };
  }, [wordMarkContext]);

  return (
    <div
      className={styles.wrapper}
      style={(visible || wordMarkContext.enable) ? {} : { display: 'none' }}
    >
      <div
        className={classnames(styles.wordMarkWrapper, {
          [styles.hidden]: !showWordMarkRef.current,
        })}
        onMouseUp={e => {
          // 内部面板阻止冒泡，避免触发 mouseup 事件
          e.stopPropagation();
        }}
        ref={(element: HTMLDivElement) => {
          (wrapperRef as any).current = element;
          initPosition();
        }}
      >
        {type ? (
          <Panel
            selectText={selectText}
            type={type}
            closeWordMark={closeWordMark}
            editorRef={editorRef}
            save={save}
          />
        ) : (
          <Inner executeCommand={executeCommand} />
        )}
      </div>
      <Editor ref={editorRef} />
    </div>
  );
}

export default WordMarkApp;
