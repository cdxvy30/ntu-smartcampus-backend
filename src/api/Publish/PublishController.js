import * as fs from 'fs';
import * as path from 'path';
import * as zipper from 'zip-local';
import { v4 as uuid } from 'uuid';
import logger from '../../logger';
import { createFolderIfNotExist, saveFileToFolder } from '../../util/general';
import { publishFeautreService } from '../../util/python';
import { PublishModel } from './PublishModel';
import { encrypt } from '../../util/crypto';

const errorLog = (message) => {
  logger.error(`[PublishController] ${message}`);
};

export const publishService = async (req, res) => {
  try {
    const {
      existId,
      arcgisUser,
      arcgisPassword,
      arcgisPortal,
      serviceName,
      fileNames,
    } = req.body;

    if (!req.files || Object.keys(req.files).length === 0)
      return res.status(400).send('請上傳檔案');
    if (
      !(
        arcgisUser
        && arcgisPassword
        && arcgisPortal
        && serviceName
        && fileNames
      )
    )
      return res.status(400).send(
        '請提供基本資訊 (arcgisUser, arcgisPassword, arcgisPortal, serviceName, fileNames',
      );

    const id = existId || uuid();
    const folderPath = path.join(__dirname, `../../../projects/${id}_files`);
    await createFolderIfNotExist(folderPath);

    fileNames.split(',').map(async (fileName, index) => {
      const filePath = path.join(folderPath, `${fileName}.zip`);
      const unzippedFolderPath = path.join(folderPath, fileName);
      await createFolderIfNotExist(unzippedFolderPath);
      await saveFileToFolder(
        Array.isArray(req.files.shapefiles) ? req.files.shapefiles[index] : req.files.shapefiles,
        filePath,
      );
      zipper.sync
        .unzip(filePath)
        .save(unzippedFolderPath);

      const files = await fs.promises.readdir(unzippedFolderPath);

      files.forEach(async (file) => {
        const extension = path.extname(file);
        await fs.promises.rename(
          path.join(unzippedFolderPath, file),
          path.join(unzippedFolderPath, fileName + extension),
        );
      });
    });

    const publishRecord = await PublishModel.findOne({ where: { id } });
    if (!publishRecord) {
      await PublishModel.create({
        id,
        status: 'Handling',
        'owner-id': req.user._id,
        'arcgis-user': arcgisUser,
        'arcgis-password': JSON.stringify(encrypt(arcgisPassword)),
        'arcgis-portal': arcgisPortal,
        'file-names': fileNames,
        'service-name': serviceName,
        message: '發佈處理中',
      });
    }

    publishFeautreService({
      pythonFilePath: path.join(__dirname, '../../../scripts/py/publish.py'),
      id,
      arcgisUser,
      arcgisPassword,
      arcgisPortal: `https://${arcgisPortal}/`,
      serviceName,
      fileNames,
    });

    return res.status(200).send('發佈資料處理中');
  } catch (err) {
    errorLog(`${err} / @publishService`);
    return res.status(500).send('無法發佈資料');
  }
};

export const getPublishStatus = async (req, res) => {
  try {
    const publishStatus = await PublishModel.findAll({
      where: { 'owner-id': req.user._id },
      attributes: { exclude: ['arcgis-password'] },
      order: [['createdAt', 'DESC']],
      limit: 20,
    });

    return res.status(200).send(publishStatus);
  } catch (err) {
    errorLog(`${err} / @getPublishStatus`);
    return res.status(500).send('無法取得發佈狀態');
  }
};

export const applyPublish = async (req, res) => {
  try {
    const {
      arcgisUser,
      arcgisPassword,
      arcgisPortal,
      serviceName,
      fileNames,
      description,
    } = req.body;

    if (
      !(
        arcgisUser
        && arcgisPassword
        && arcgisPortal
        && serviceName
        && fileNames
        && description
      )
    )
      return res.status(400).send(
        '請提供基本資訊 (arcgisUser, arcgisPassword, arcgisPortal, serviceName, fileNames, description',
      );

    const id = uuid();
    await PublishModel.create({
      id,
      status: 'Pending',
      'owner-id': req.user._id,
      'arcgis-user': arcgisUser,
      'arcgis-password': JSON.stringify(encrypt(arcgisPassword)),
      'arcgis-portal': arcgisPortal,
      'file-names': fileNames,
      'service-name': serviceName,
      description,
      message: '等待管理員驗證',
    });

    return res.status(200).send('發佈資料處理中');
  } catch (err) {
    errorLog(`${err} / @applyPublish`);
    return res.status(500).send('無法發佈資料');
  }
};
