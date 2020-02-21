import * as typescript from './typescript'
import { watchFile, unwatchFile, Stats} from 'fs'

const watchFiles = (rootFileNames: string[], originalServicePath: string, cb: () => Promise<void>): void => {
  const tsConfig = typescript.getTypescriptConfig(originalServicePath)
  let watchedFiles = typescript.getSourceFiles(rootFileNames, tsConfig)

  watchedFiles.forEach(fileName => {
    watchFile(fileName, { persistent: true, interval: 250 }, watchCallback)
  })

  const watchCallback = (curr: Stats, prev: Stats): void => {
    // Check timestamp
    if (+curr.mtime <= +prev.mtime) {
      return
    }

    cb()

    // use can reference not watched yet file or remove reference to already watched
    const newWatchFiles =  typescript.getSourceFiles(rootFileNames, tsConfig)
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
}

export default watchFiles