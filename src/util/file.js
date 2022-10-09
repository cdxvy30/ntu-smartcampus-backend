import logger from '../logger';

const fse = require('fs-extra');
const path = require('path');

const infoLog = (message) => {
  logger.info(`[File] ${message}`);
};

export const backupFiles = async () => {
  try {
    const srcDir = path.join(__dirname, '../../data');
    const destDir = path.join(__dirname, '../../backups/tmp/file');
    if (!fse.existsSync(destDir))
      fse.mkdirSync(destDir, { recursive: true });

    await fse.copySync(srcDir, destDir);

    return infoLog('備份檔案!');
  } catch (err) {
    throw `${err} / @file.backupFiles`;
  }
};

export const restoreFiles = async () => {
  try {
    const srcDir = path.join(__dirname, '../../backups/tmp/file');
    const destDir = path.join(__dirname, '../../data');
    if (fse.existsSync(destDir)) {
      await fse.emptyDirSync(destDir);
      infoLog('移除檔案!');
    }

    fse.copySync(srcDir, destDir);

    return infoLog('還原檔案!');
  } catch (err) {
    throw `${err} / @file.restoreFiles`;
  }
};
