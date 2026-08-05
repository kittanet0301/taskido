import { app } from 'electron'
import { join } from 'path'

export function getAppIconPath(): string {
  if (!app.isPackaged) {
    if (process.platform === 'win32') return join(app.getAppPath(), 'build', 'icons', 'taskino.ico')
    if (process.platform === 'darwin') return join(app.getAppPath(), 'build', 'icons', 'taskino.icns')
    return join(app.getAppPath(), 'assets', 'ui', 'hud-icon-dino.png')
  }

  if (process.platform === 'win32') return join(process.resourcesPath, 'app-icon.ico')
  if (process.platform === 'darwin') return join(process.resourcesPath, 'app-icon.icns')
  return join(process.resourcesPath, 'hud-icon-dino.png')
}
