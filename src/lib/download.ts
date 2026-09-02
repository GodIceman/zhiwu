type ZhiwuExportWindow = Window & {
  ZhiwuFileExport?: {
    saveTextFile: (filename: string, text: string, type: string) => void
  }
}

export function downloadTextFile(filename: string, text: string, type: string) {
  const nativeExport = (window as ZhiwuExportWindow).ZhiwuFileExport

  if (nativeExport) {
    nativeExport.saveTextFile(filename, text, type)
    return
  }

  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
