declare module 'claude-code' {
  interface PluginState {
    claudo: {
      // the txt being read ('' while none is chosen)
      path: string
      // first sentence of the page on screen
      pos: number
      // boss mode: code only, no text from the file
      boss: boolean
      // bumped when a load finishes or fails, so the pane draws again
      loaded: number
      // what went wrong last, '' when nothing
      error: string
      // inline mode: sentences are drawn under the transcript's rows
      inline: boolean
      // row key (a tool_use_id, or t:<hash of a reply block's text>) -> first sentence
      marks: Record<string, [number, number]>
      // tool rows whose block is opened (tool_use_id -> true)
      open: Record<string, boolean>
    }
  }
}
