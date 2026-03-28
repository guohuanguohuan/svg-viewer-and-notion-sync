import { App } from 'obsidian'

import SmartComposerPlugin from '../../main'

import { ChatSection } from './sections/ChatSection'
import { McpSection } from './sections/McpSection'
import { ModelsSection } from './sections/ModelsSection'
import { TemplateSection } from './sections/TemplateSection'

type SettingsTabRootProps = {
  app: App
  plugin: SmartComposerPlugin
}

export function SettingsTabRoot({ app, plugin }: SettingsTabRootProps) {
  return (
    <>
      <ChatSection />
      <TemplateSection app={app} />
      <ModelsSection app={app} plugin={plugin} />
      <McpSection app={app} plugin={plugin} />
    </>
  )
}
