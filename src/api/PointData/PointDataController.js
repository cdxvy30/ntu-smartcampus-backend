import * as path from 'path';
import {
  isVersionDownloadable,
  saveFileToFolder,
  createFolderIfNotExist,
  renameFileWithVersion,
  getDataRecord,
  getPendingRecord,
  getPublicData,
  getPrivateData,
  getAvailVersion,
  removeFile,
  removeValidateRecord,
  removeDataRecordAndFolder,
} from '../../util/general';
import {
  getTable,
  removeTable,
  isTableExist,
  isVersionExist,
  getLatestVersion,
} from '../../util/database';
import {
  isUserAuthorized,
  isUploadAuthorized,
  isDeleteAuthorized,
  isAdmin,
} from '../../util/authorize';
import { readJsonPoint, readExcelPoint, writeExcel } from '../../util/io';
import { ValidationModel } from '../Admin/AdminModel';
import { PointDataModel } from './PointDataModel';
import logger from '../../logger';

const errorLog = (message) => {
  logger.error(`[PointDataController] ${message}`);
};

export const postPointData = async (req, res) => {
  try {
    const {
      fileName,
      keyPropertyName,
      xPropertyName,
      yPropertyName,
      dataStruct,
      coordinateSystem,
      isPublic,
      isDownloadable,
      description,
    } = req.body;

    // 檢查request
    if (!req.files || Object.keys(req.files).length === 0)
      return res.status(400).send('請上傳檔案');
    if (!dataStruct || dataStruct.length === 0)
      return res.status(400).send('請提供檔案架構');
    if (
      !(
        fileName
        && keyPropertyName
        && xPropertyName
        && yPropertyName
        && coordinateSystem
        && description
      )
    )
      return res.status(400).send(
        '請提供基本資訊 (fileName, keyPropertyName, xPropertyName, yPropertyName, coordinateSystem, description)',
      );

    const tableName = fileName.substr(0, fileName.lastIndexOf('.'));
    const folderPath = path.join(__dirname, `../../../data/point-data/${tableName}`);
    const filePath = path.join(folderPath, fileName);
    const extension = path.extname(fileName);

    if (!await isUploadAuthorized(PointDataModel, tableName, req.user))
      return res.status(400).send(`已存在命名為 ${tableName} 之檔案，請更換名稱後上傳`);
    if (!['.xlsx', '.xls', '.json'].includes(extension))
      return res.status(400).send('請上傳Excel或Json格式的檔案');

    await createFolderIfNotExist(folderPath);
    await saveFileToFolder(req.files.data, filePath);
    const status = ['.xlsx', '.xls'].includes(extension)
      ? await readExcelPoint({
        fileName,
        filePath,
        dataStruct,
        xPropertyName,
        yPropertyName,
        keyPropertyName,
        coordinateSystem,
      })
      : await readJsonPoint({
        fileName,
        filePath,
        dataStruct,
        xPropertyName,
        yPropertyName,
        keyPropertyName,
        coordinateSystem,
      });

    if (!status.complete) {
      await removeFile(filePath);
      return res.status(400).send(status.message);
    }

    const pointDataRecord = await getDataRecord(PointDataModel, tableName);
    if (!pointDataRecord) {
      await PointDataModel.create({
        name: tableName,
        'key-property-name': keyPropertyName,
        'x-property-name': xPropertyName,
        'y-property-name': yPropertyName,
        'owner-id': req.user._id,
        version: 1.0,
        public: isPublic === 'true',
        description,
      });

      if (isPublic === 'true') {
        await ValidationModel.create({
          name: tableName,
          'owner-id': req.user._id,
          version: 1.0,
          validated: await isAdmin(req.user),
          downloadable: isDownloadable === 'true',
        });
      }

      await renameFileWithVersion(filePath, '1.0');
    } else {
      const newVersion = (parseFloat(pointDataRecord.version) + 1.0).toFixed(1);
      await pointDataRecord.update({
        version: newVersion,
      });

      if (isPublic === 'true') {
        const pendingRecord = await getPendingRecord(tableName);
        if (pendingRecord) {
          await pendingRecord.update({
            version: newVersion,
            validated: await isAdmin(req.user),
            downloadable: isDownloadable === 'true',
          });
        } else {
          await ValidationModel.create({
            name: tableName,
            'owner-id': req.user._id,
            version: newVersion,
            validated: await isAdmin(req.user),
            downloadable: isDownloadable === 'true',
          });
        }
      }

      await renameFileWithVersion(filePath, newVersion);
    }

    return res.status(200).send(`已成功上傳 ${fileName}`);
  } catch (err) {
    errorLog(`${err} / @postPointData`);
    return res.status(500).send(`無法上傳資料 ${req.body.fileName}`);
  }
};

export const getPointDataList = async (req, res) => {
  try {
    const publicData = await getPublicData(PointDataModel, req.user);
    const privateData = await getPrivateData(PointDataModel, req.user);

    res
      .status(200)
      .send(Array.prototype.concat.apply([], [publicData, privateData]));
  } catch (err) {
    errorLog(`${err} / @getPointDataList`);
    res.status(500).send('無法取得資料');
  }
};

export const getPointData = async (req, res) => {
  try {
    const { fileName, version } = req.params;

    if (!await isTableExist(fileName))
      return res.status(400).send(`${fileName} 資料不存在`);
    if (version && !await isVersionExist(fileName, version))
      return res.status(400).send(`版本 ${version} 不存在`);
    if (!await isUserAuthorized(PointDataModel, fileName, req.user, version))
      return res.status(400).send(`${fileName} 無權限讀取`);

    const availVersion = await getAvailVersion(PointDataModel, fileName, req.user);
    const result = await getTable(fileName, version || availVersion);

    return res.status(200).send(result);
  } catch (err) {
    errorLog(`${err} / @getPointData`);
    return res.status(500).send(`無法取得資料  ${req.query.fileName}`);
  }
};

export const getKeyPropList = async (req, res) => {
  try {
    const { fileName, version } = req.params;
    const { selectedProperty } = req.query;

    if (!await isTableExist(fileName))
      return res.status(400).send(`${fileName} 資料不存在`);
    if (version && !await isVersionExist(fileName, version))
      return res.status(400).send(`版本 ${version} 不存在`);
    if (!await isUserAuthorized(PointDataModel, fileName, req.user, version))
      return res.status(400).send(`${fileName} 無權限讀取`);

    const availVersion = await getAvailVersion(PointDataModel, fileName, req.user);
    const result = await getTable(fileName, version || availVersion);

    const pointDataRecord = await getDataRecord(PointDataModel, fileName);
    const keyPropertyName = pointDataRecord['key-property-name'];
    const referenceList = [];

    result.map((feature) => {
      referenceList.push({
        [keyPropertyName]: feature[keyPropertyName],
        [selectedProperty]: feature[selectedProperty],
      });
    });

    return res.status(200).send(referenceList);
  } catch (err) {
    errorLog(`${err} / @getKeyPropList`);
    return res.status(500).send('無法取得資料');
  }
};

export const downloadPointData = async (req, res) => {
  try {
    const { fileName, version } = req.params;

    if (!await isTableExist(fileName))
      return res.status(400).send(`${fileName} 資料不存在`);
    if (version && !await isVersionExist(fileName, version))
      return res.status(400).send(`版本 ${version} 不存在`);
    if (version && !await isVersionDownloadable(PointDataModel, req.user, fileName, version))
      return res.status(400).send(`版本 ${version} 無開放下載`);
    if (!await isUserAuthorized(PointDataModel, fileName, req.user, version))
      return res.status(400).send(`${fileName} 無權限讀取`);

    const isDownloadNeeded = true;
    const availVersion = await getAvailVersion(
      PointDataModel, fileName, req.user, isDownloadNeeded,
    );
    if (!version && !availVersion) return res.status(400).send(`${fileName} 無開放下載`);

    const workbook = await writeExcel(fileName, version || availVersion);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment;filename*=UTF-8''${encodeURIComponent(`${fileName}.xlsx`)}`,
    );

    return workbook.xlsx.write(res).then(() => {
      res.status(200).end();
    });
  } catch (err) {
    errorLog(`${err} / @downloadPointData`);
    return res.status(500).send(`無法下載資料 ${req.query.fileName}`);
  }
};

export const removePointData = async (req, res) => {
  try {
    const { fileName, version } = req.params;

    if (!await isTableExist(fileName))
      return res.status(400).send(`${fileName} 資料不存在`);
    if (version && !await isVersionExist(fileName, version))
      return res.status(400).send(`版本 ${version} 不存在`);
    if (!await isDeleteAuthorized(PointDataModel, fileName, req.user))
      return res.status(400).send(`${fileName} 無權限刪除`);

    await removeTable(fileName, version);

    const folderPath = path.join(__dirname, `../../../data/point-data/${fileName}`);
    if (version) {
      const filePath = `${folderPath}/${fileName} - v${parseFloat(version).toFixed(1)}.xlsx`;
      await removeFile(filePath);

      if (!await isTableExist(fileName)) {
        await removeDataRecordAndFolder(PointDataModel, fileName, folderPath);
      } else {
        const latestVersion = await getLatestVersion(fileName);
        await PointDataModel.update(
          { version: latestVersion },
          { where: { name: fileName } },
        );
      }
    } else {
      await removeDataRecordAndFolder(PointDataModel, fileName, folderPath);
    }

    removeValidateRecord(fileName, version);

    return res.status(200).send(`成功刪除資料  ${req.params.fileName}`);
  } catch (err) {
    errorLog(`${err} / @removePointData`);
    return res.status(500).send(`無法刪除資料  ${req.params.fileName}`);
  }
};
