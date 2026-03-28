import { App, TFile } from 'obsidian'

import { ReactModal } from '../../common/ReactModal'

type IncludedFilesModalComponentProps = {
  files: TFile[]
  patterns: string[]
}

export class IncludedFilesModal extends ReactModal<IncludedFilesModalComponentProps> {
  constructor(app: App, files: TFile[], patterns: string[]) {
    super({
      app: app,
      Component: IncludedFilesModalComponent,
      props: { files, patterns },
      options: {
        title: `已包含 ${files.length} 个文件`,
      },
    })
  }
}

function IncludedFilesModalComponent({
  files,
  patterns,
}: IncludedFilesModalComponentProps) {
  return patterns.length === 0 ? (
    <div>
      未设置包含规则，默认会包含所有文件（排除规则命中的文件除外）
    </div>
  ) : files.length === 0 ? (
    <div>没有文件匹配当前包含规则</div>
  ) : (
    <ul>
      {files.map((file) => (
        <li key={file.path}>{file.path}</li>
      ))}
    </ul>
  )
}
