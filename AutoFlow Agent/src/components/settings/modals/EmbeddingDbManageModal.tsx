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
        title: 'Legacy vector note',
      },
    })
    this.modalEl.style.width = '640px'
  }
}

function EmbeddingDbManageModalComponent() {
  return (
    <div className="smtcmp-settings-section">
      <div className="smtcmp-settings-desc">
        The mainline retrieval flow now uses search-based RAG in Obsidian.
        <br />
        Local embeddings, vector databases, and index rebuild steps are no longer
        part of the default runtime path.
      </div>

      <div className="smtcmp-settings-desc">
        This legacy entry is kept only as a migration note for older configs.
        New features should not continue to depend on local embedding configs,
        vector index maintenance, or vector database operations.
      </div>

      <div className="smtcmp-settings-desc">
        The intended flow is:
        <br />
        <code>
          Obsidian search -&gt; filter hits -&gt; read relevant paragraphs or
          heading blocks -&gt; send snippets with sources to the model
        </code>
      </div>
    </div>
  )
}
