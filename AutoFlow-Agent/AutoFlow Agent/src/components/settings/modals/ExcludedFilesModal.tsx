import { App, TFile } from 'obsidian'

import { ReactModal } from '../../common/ReactModal'

type ExcludedFilesModalComponentProps = {
  files: TFile[]
}

export class ExcludedFilesModal extends ReactModal<ExcludedFilesModalComponentProps> {
  constructor(app: App, files: TFile[]) {
    super({
      app: app,
      Component: ExcludedFilesModalComponent,
      props: { files },
      options: {
        title: `已排除 ${files.length} 个文件`,
      },
    })
  }
}

function ExcludedFilesModalComponent({
  files,
}: ExcludedFilesModalComponentProps) {
  return files.length === 0 ? (
    <div>没有文件匹配当前排除规则</div>
  ) : (
    <ul>
      {files.map((file) => (
        <li key={file.path}>{file.path}</li>
      ))}
    </ul>
  )
}
