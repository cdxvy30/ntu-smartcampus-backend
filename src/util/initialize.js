import schedule from 'node-schedule';
import * as path from 'path';
import logger from '../logger';
import { UserModel } from '../api/User/UserModel';
import { isDatabaseExist, createDatabase } from './database';
import { createFolderIfNotExist } from './general';
import { restoreSystem } from './backup';
import { config } from '../config';
import { postBackup } from '../api/Backup/BackupController';

const bcrypt = require('bcrypt');
const uniqid = require('uniqid');
const sequelize = require('./sequelize');

const errorLog = (message) => {
  logger.error(`[Initialize] ${message}`);
};

const infoLog = (message) => {
  logger.info(`[Initialize] ${message}`);
};

const initializeAdmin = async () => {
  try {
    const { adminUsername, adminPassword, adminEmail } = config.development;
    const [, created] = await UserModel.findOrCreate({
      where: { username: adminUsername },
      defaults: {
        _id: uniqid(),
        username: adminUsername,
        email: adminEmail,
        password: bcrypt.hashSync(adminPassword, 10),
        displayName: '管理員',
        department: 'Admin',
        role: 'admin',
        validated: true,
      },
    });

    if (created) infoLog('新增使用者 (Admin)');
    return;
  } catch (err) {
    errorLog(`${err} / @initialize.initializeAdmin`);
  }
};

const initializeSystem = async () => {
  try {
    const { restore, version } = config.development;

    const basePath = path.join(__dirname, '../../');
    await createFolderIfNotExist(`${basePath}data`);
    await createFolderIfNotExist(`${basePath}backups`);
    await createFolderIfNotExist(`${basePath}logs`);

    if (restore === 'true') {
      await restoreSystem(version);
      return;
    }

    if (!await isDatabaseExist()) {
      await createDatabase();
      infoLog(`新增Database (${config.development.database})`);
    }
    return;
  } catch (err) {
    errorLog(`${err} / @initialize.initializeSystem`);
  }
};

const initializeBackup = async () => {
  try {
    schedule.scheduleJob('0 30 00 * * *', () => {
      const mockReq = { user: { role: 'admin' } };
      const mockRes = {
        status: () => mockRes,
        send: (message) => {
          if (message === '成功備份資料')
            infoLog(`Backup Success @${(new Date()).toISOString()}`);
          else
            errorLog(`Backup Fail @${(new Date()).toISOString()}`);
        },
      };
      postBackup(mockReq, mockRes);
    });
  } catch (err) {
    errorLog(`${err} / @initialize.initializeBackup`);
  }
};

export const initialize = async () => {
  try {
    await initializeSystem();
    await sequelize.sync();
    await initializeAdmin();
    await initializeBackup();

    return;
  } catch (err) {
    errorLog(`${err} / @initialize.initialize`);
  }
};
