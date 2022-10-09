import logger from '../logger';
import { backupFiles, restoreFiles } from './file';
import { backupDatabase, restoreDatabase } from './database';

const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const zipper = require('zip-local');

const errorLog = (message) => {
  logger.error(`[Backup] ${message}`);
};

const infoLog = (message) => {
  logger.info(`[Backup] ${message}`);
};

export const restoreSystem = async (version) => {
  try {
    const backupPath = path.join(__dirname, '../../backups');
    const backupNames = await fs.promises.readdir(backupPath);
    if (backupNames.length === 0)
      throw '尚未找到任何備份檔案，無法備份!';

    let targetBackupName = '';
    if (!version) {
      const timestamps = backupNames.map((f) => {
        let timeString = f;
        timeString = timeString.replace('.zip', '');
        timeString = `${timeString.substring(0, 13)}:${timeString.substring(13 + 1)}`;
        timeString = `${timeString.substring(0, 16)}:${timeString.substring(16 + 1)}`;
        return new Date(timeString);
      });
      const latest = timestamps.sort((a, b) => b - a)[0];
      targetBackupName = `${latest.toISOString().replaceAll(':', '-')}.zip`;
    } else {
      targetBackupName = `${version}.zip`;
      if (!backupNames.find((f) => targetBackupName === f))
        throw '尚未找到該版本備份檔案，無法備份!';
    }

    if (!fs.existsSync(path.join(backupPath, 'tmp')))
      fs.mkdirSync(
        path.join(backupPath, 'tmp'),
        { recursive: true },
      );

    zipper.sync
      .unzip(path.join(backupPath, targetBackupName))
      .save(path.join(backupPath, 'tmp'));

    await restoreDatabase();
    await restoreFiles();
    await fse.remove(path.join(backupPath, 'tmp'));

    infoLog('新建並匯入系統資料!');
    return;
  } catch (err) {
    errorLog(`${err} / @backup.restoreSystem`);
  }
};

export const backupSystem = async () => {
  try {
    await backupDatabase();
    await backupFiles();

    const date = new Date();
    const currentTime = date.toISOString().replaceAll(':', '-');
    const backupPath = path.join(__dirname, '../../backups');
    zipper.sync.zip(path.join(backupPath, 'tmp'))
      .compress()
      .save(path.join(backupPath, `${currentTime}.zip`));
    await fse.remove(path.join(backupPath, 'tmp'));

    infoLog('備份系統資料!');
    return;
  } catch (err) {
    errorLog(`${err} / @backup.restoreSystem`);
  }
};
