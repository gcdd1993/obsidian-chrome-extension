import DisableUrlCard, { IDisableUrlItem } from '@/components/DisableUrlCard';
import { ClipConfigKey, IClipConfig, clipConfigManager } from '@/core/configManager/clip';
import { ILevitateConfig, LevitateConfigKey, levitateConfigManager } from '@/core/configManager/levitate';
import { Input, Switch } from 'antd';
import React, { useCallback, useEffect, useState } from 'react';
import styles from './index.module.less';

function Shortcut() {
  const [config, setConfig] = useState({} as ILevitateConfig);
  const [clipConfig, setClipConfig] = useState({} as IClipConfig);

  const onConfigChange = useCallback(async (key: LevitateConfigKey, value: any) => {
    await levitateConfigManager.update(key, value);
    setConfig(pre => ({
      ...pre,
      [key]: value,
    }));
  }, []);

  const onClipConfigChange = async (key: ClipConfigKey, value: any) => {
    await clipConfigManager.update(key, value);
    setClipConfig(pre => ({
      ...pre,
      [key]: value,
    }));
  };

  const onDelete = useCallback(
    (item: IDisableUrlItem) => {
      const filterArray = config.disableUrl?.filter(d => d.origin !== item.origin);
      onConfigChange('disableUrl', filterArray);
    },
    [config],
  );

  useEffect(() => {
    levitateConfigManager.get().then(res => {
      setConfig(res);
    });

    clipConfigManager.get().then(res => {
      setClipConfig(res);
    });
  }, []);

  return (
    <div className={styles.configWrapper}>
      <div className={styles.configCard}>
        <div className={styles.body}>
          <div className={styles.configItem}>
            <div className={styles.desc}>{__i18n('展示侧边栏悬浮气泡')}</div>
            <Switch checked={config.enable} onChange={() => onConfigChange('enable', !config.enable)} size="small" />
          </div>
          {!!config.disableUrl?.length && (
            <div>
              <div className={styles.desc}>{__i18n('管理不展示侧边栏气泡的页面')}</div>
              <div className={styles.disableUrlCard}>
                <DisableUrlCard options={config.disableUrl} onDelete={onDelete} />
              </div>
            </div>
          )}
          <div className={styles.configItem}>
            <div className={styles.desc}>{__i18n('剪藏内容保留来源地址')}</div>
            <Switch
              checked={clipConfig.addLink}
              onChange={() => onClipConfigChange('addLink', !clipConfig.addLink)}
              size="small"
            />
          </div>
          <div className={styles.configItem}>
            <div className={styles.desc}>{__i18n('Obsidian API 地址')}</div>
            <Input
              value={clipConfig.obsidianApiUrl}
              placeholder="https://127.0.0.1:27124"
              onChange={e => onClipConfigChange('obsidianApiUrl', e.target.value)}
            />
          </div>
          <div className={styles.configItem}>
            <div className={styles.desc}>{__i18n('Obsidian API Key')}</div>
            <Input.Password
              value={clipConfig.obsidianApiKey}
              placeholder={__i18n('在 Obsidian Local REST API 插件中获取')}
              onChange={e => onClipConfigChange('obsidianApiKey', e.target.value)}
            />
          </div>
          <div className={styles.configItem}>
            <div className={styles.desc}>{__i18n('Obsidian 导出目录')}</div>
            <Input
              value={clipConfig.obsidianExportDir}
              placeholder="Yuque Export"
              onChange={e => onClipConfigChange('obsidianExportDir', e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(Shortcut);
