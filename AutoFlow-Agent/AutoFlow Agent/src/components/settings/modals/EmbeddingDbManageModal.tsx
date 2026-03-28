import { App } from 'obsidian'

import SmartComposerPlugin from '../../../main'
import { ReactModal } from '../../common/ReactModal'

type EmbeddingDbManagerModalComponentWrapperProps = {
  app: App
  plugin: SmartComposerPlugin
}

export class EmbeddingDbManageModal extends ReactModal<EmbeddingDbManagerModalComponentWrapperProps> {
  constructor(app: App, plugin: SmartComposerPlugin) {
    super({
      app,
      Component: EmbeddingDbManageModalComponent,
      props: { app, plugin },
      options: {
        title: '旧向量说明',
      },
    })
    this.modalEl.style.width = '640px'
  }
}

function EmbeddingDbManageModalComponent() {
  return (
    <div className="smtcmp-settings-section">
      <div className="smtcmp-settings-desc">
        当前主线检索流程，已经改为基于 Obsidian 搜索的 RAG。
        <br />
        本地 embedding、向量数据库和重建索引步骤，已经不再属于默认运行路径。
      </div>

      <div className="smtcmp-settings-desc">
        这个入口只作为旧配置迁移说明保留。
        <br />
        后续新功能不要再继续依赖本地 embedding 配置、向量索引维护或向量数据库操作。
      </div>

      <div className="smtcmp-settings-desc">
        当前推荐链路是：
        <br />
        <code>
          Obsidian 搜索 -&gt; 过滤命中 -&gt; 读取相关段落或标题块 -&gt;
          把带来源的片段发送给模型
        </code>
      </div>
    </div>
  )
}
