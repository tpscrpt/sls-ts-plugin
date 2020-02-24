import { watchFile, unwatchFile, Stats } from 'fs'

import { ServerlessTSInstance } from './serverlessTypes'
import { getSourceFiles, getTypescriptConfig } from './typescript'

export const watchFiles = (
  rootFileNames: string[],
  originalServicePath: string,
  serverless: ServerlessTSInstance,
  cb: () => Promise<void>
): void => {
  const tsConfig = getTypescriptConfig(originalServicePath, serverless)
  let watchedFiles = getSourceFiles(rootFileNames, tsConfig)

  const watchCallback = (curr: Stats, prev: Stats): void => {
    // Check timestamp
    if (+curr.mtime <= +prev.mtime) {
      return
    }

    cb()

    // use can reference not watched yet file or remove reference to already watched
    const newWatchFiles = getSourceFiles(rootFileNames, tsConfig)
    watchedFiles.forEach(fileName => {
      if (!newWatchFiles.includes(fileName)) {
        unwatchFile(fileName, watchCallback)
      }
    })

    newWatchFiles.forEach(fileName => {
      if (!watchedFiles.includes(fileName)) {
        watchFile(fileName, { persistent: true, interval: 250 }, watchCallback)
      }
    })

    watchedFiles = newWatchFiles
  }

  watchedFiles.forEach(fileName => {
    watchFile(fileName, { persistent: true, interval: 250 }, watchCallback)
  })
}
