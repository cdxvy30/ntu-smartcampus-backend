import { backupSystem } from '../../util/backup';
import { isAdmin } from '../../util/authorize';
import logger from '../../logger';

const errorLog = (message) => {
  logger.error(`[BackupController] ${message}`);
};

export const postBackup = async (req, res) => {
  try {
    if (!await isAdmin(req.user))
      return res.status(400).send('無管理者權限，無法備份');

    await backupSystem();

    return res.status(200).send('成功備份資料');
  } catch (err) {
    errorLog(`${err} / @postBackup`);
    return res.status(500).send('無法備份資料');
  }
};
