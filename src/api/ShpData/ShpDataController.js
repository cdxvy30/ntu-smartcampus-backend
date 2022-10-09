import * as path from 'path';
import * as fs from 'fs';
import {
  isFolderEmpty,
  isShapeFileExist,
  isKeyPropertyValueExist,
  isCommonFileExist,
  isCommonFileVersionExist,
  isVersionDownloadable,
  createFolderIfNotExist,
  saveFileToFolder,
  saveLayerToFolder,
  renameFileWithVersion,
  renameLayerWithVersion,
  getDataFromFile,
  getDataRecord,
  getPendingRecord,
  getPublicData,
  getPrivateData,
  getAvailVersion,
  getCommonFileLatestVersion,
  removeFile,
  removeValidateRecord,
  removeDataRecordAndFolder,
} from '../../util/general';
import {
  getTable,
  getTableKey,
  getJoinedTable,
  isTableExist,
  isVersionExist,
  getLatestVersion,
  removeTable,
} from '../../util/database';
import {
  isUserAuthorized,
  isUploadAuthorized,
  isDeleteAuthorized,
  isAdmin,
} from '../../util/authorize';
import { readJsonShp, readExcelShp, writeExcel } from '../../util/io';
import { createFeatureLayer } from '../../util/shapefile';
import { ShapeFileModel, ShapeDataModel, CommonFileModel } from './ShpDataModel';
import { ValidationModel } from '../Admin/AdminModel';
import logger from '../../logger';

const errorLog = (message) => {
  logger.error(`[ShpDataController] ${message}`);
};

export const postShpFile = async (req, res) => {
  try {
    const {
      fileName, keyPropertyName, isPublic, isDownloadable, description,
    } = req.body;

    // 檢查request
    if (!req.files || Object.keys(req.files).length === 0)
      return res.status(400).send('請上傳檔案');
    if (req.files.shapefile.name.slice(req.files.shapefile.name.length - 4) !== '.zip')
      return res.status(400).send('請上傳zip格式檔案');
    if (!(fileName && keyPropertyName && description))
      return res.status(400).send('請提供基本資訊');
    if (!await isUploadAuthorized(ShapeFileModel, fileName, req.user))
      return res.status(400).send(`已存在命名為 ${fileName} 之檔案，請更換名稱後上傳`);

    const folderPath = path.join(__dirname, `../../../data/shp-file/${fileName}`);
    const filePath = `${folderPath}/${fileName}.zip`;

    await createFolderIfNotExist(folderPath);
    await saveFileToFolder(req.files.shapefile, filePath);
    const status = await createFeatureLayer(filePath, fileName);
    if (!status.complete) {
      await removeFile(filePath);
      return res.status(400).send(status.message);
    }
    const layer = status.featureLayer;
    await saveLayerToFolder(filePath, layer);

    let shapeFileRecord = await getDataRecord(ShapeFileModel, fileName);
    if (!shapeFileRecord) {
      shapeFileRecord = await ShapeFileModel.create({
        name: fileName,
        path: '',
        'owner-id': req.user._id,
        public: isPublic === 'true',
        version: 1.0,
        description,
      });

      await ShapeDataModel.create({
        name: fileName,
        'shapefile-id': shapeFileRecord.id,
        'key-property-name': keyPropertyName,
        'owner-id': req.user._id,
        version: 1.0,
        public: isPublic === 'true',
        description,
      });

      if (isPublic === 'true') {
        await ValidationModel.create({
          name: fileName,
          'owner-id': req.user._id,
          version: 1.0,
          validated: await isAdmin(req.user),
          downloadable: isDownloadable === 'true',
        });
      }

      await renameFileWithVersion(filePath, '1.0');
      await renameLayerWithVersion(filePath, '1.0');
    } else {
      const newVersion = (parseFloat(shapeFileRecord.version) + 1.0).toFixed(1);
      await shapeFileRecord.update({
        version: newVersion,
      });

      await ShapeDataModel.update(
        { version: newVersion },
        { where: { name: fileName } },
      );

      if (isPublic === 'true') {
        const pendingRecord = await getPendingRecord(fileName);
        if (pendingRecord) {
          await pendingRecord.update({
            version: newVersion,
            validated: await isAdmin(req.user),
            downloadable: isDownloadable === 'true',
          });
        } else {
          await ValidationModel.create({
            name: fileName,
            'owner-id': req.user._id,
            version: newVersion,
            validated: await isAdmin(req.user),
            downloadable: isDownloadable === 'true',
          });
        }
      }

      await renameFileWithVersion(filePath, newVersion);
      await renameLayerWithVersion(filePath, newVersion);
    }

    return res.status(200).send(`已成功上傳 ${fileName}`);
  } catch (err) {
    errorLog(`${err} / @postShpFile`);
    return res.status(500).send(`無法上傳資料 ${req.body.fileName}`);
  }
};

export const postShpData = async (req, res) => {
  try {
    const {
      fileName, keyPropertyName, dataStruct, isPublic, isDownloadable, bindingShpName, description,
    } = req.body;

    // 檢查request
    if (!req.files || Object.keys(req.files).length === 0)
      return res.status(400).send('請上傳檔案');
    if (!dataStruct || dataStruct.length === 0)
      return res.status(400).send('請提供檔案架構');
    if (!(fileName && keyPropertyName && bindingShpName && description))
      return res.status(400).send('請提供基本資訊 (fileName, keyPropertyName, bindingShpName, description)');
    if (!await isShapeFileExist(bindingShpName))
      return res.status(400).send(`無名稱為 ${bindingShpName} 之 Shapefile`);
    if (!await isUserAuthorized(ShapeFileModel, bindingShpName, req.user))
      return res.status(400).send(`無權限綁定 ${bindingShpName}`);

    const tableName = fileName.substr(0, fileName.lastIndexOf('.'));
    const folderPath = path.join(__dirname, `../../../data/shp-data/${tableName}`);
    const filePath = `${folderPath}/${fileName}`;
    const extension = path.extname(fileName);

    if (!await isUploadAuthorized(ShapeDataModel, tableName, req.user))
      return res.status(400).send(`已存在命名為 ${tableName} 之檔案，請更換名稱後上傳`);
    if (!['.xlsx', '.xls', '.json'].includes(extension))
      return res.status(400).send('請上傳Excel或Json格式的檔案');

    await createFolderIfNotExist(folderPath);
    await saveFileToFolder(req.files.data, filePath);
    const status = ['.xlsx', '.xls'].includes(extension)
      ? await readExcelShp({
        fileName,
        filePath,
        dataStruct,
        keyPropertyName,
      })
      : await readJsonShp({
        fileName,
        filePath,
        dataStruct,
        keyPropertyName,
      });

    if (!status.complete) {
      await removeFile(filePath);
      return res.status(400).send(status.message);
    }

    const shapeFileRecord = await getDataRecord(ShapeFileModel, bindingShpName);
    const shapeDataRecord = await getDataRecord(ShapeDataModel, tableName);
    if (!shapeDataRecord) {
      await ShapeDataModel.create({
        name: tableName,
        'shapefile-id': shapeFileRecord.id,
        'key-property-name': keyPropertyName,
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
      const newVersion = (parseFloat(shapeDataRecord.version) + 1.0).toFixed(1);
      await shapeDataRecord.update({
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
    errorLog(`${err} / @postShpData`);
    return res.status(500).send(`無法上傳資料 ${req.body.fileName}`);
  }
};

export const postCommonFile = async (req, res) => {
  try {
    const {
      fileName, keyPropertyValue, bindingShpName, isPublic, isDownloadable, description,
    } = req.body;

    // 檢查request
    if (!req.files || Object.keys(req.files).length === 0)
      return res.status(400).send('請上傳檔案');
    if (!(fileName && keyPropertyValue && bindingShpName && description))
      return res.status(400).send('請提供基本資訊 (fileName, keyPropertyValue, bindingShpName, description)');
    if (!await isUploadAuthorized(CommonFileModel, fileName, req.user))
      return res.status(400).send(`已存在命名為 ${fileName} 之檔案，請更換名稱後上傳`);
    if (!await isShapeFileExist(bindingShpName))
      return res.status(400).send(`無名稱為 ${bindingShpName} 之 Shapefile`);
    if (!await isUserAuthorized(ShapeFileModel, bindingShpName, req.user))
      return res.status(400).send(`無權限綁定 ${bindingShpName}`);
    if (!await isKeyPropertyValueExist(ShapeFileModel, bindingShpName, req.user, keyPropertyValue))
      return res.status(400).send(`${bindingShpName} 裡無名稱為 ${keyPropertyValue} 之Key`);

    const folderName = fileName.substr(0, fileName.lastIndexOf('.'));
    const folderPath = path.join(__dirname, `../../../data/common-file/${folderName}`);
    const filePath = `${folderPath}/${fileName}`;

    await createFolderIfNotExist(folderPath);
    await saveFileToFolder(req.files.commonfile, filePath);

    const shapeFileRecord = await getDataRecord(ShapeFileModel, bindingShpName);
    const commonFileRecord = await getDataRecord(CommonFileModel, fileName);
    if (!commonFileRecord) {
      await CommonFileModel.create({
        name: fileName,
        'shapefile-id': shapeFileRecord.id,
        'key-property-value': keyPropertyValue,
        path: '',
        'owner-id': req.user._id,
        public: isPublic === 'true',
        version: 1.0,
        description,
      });

      if (isPublic === 'true') {
        await ValidationModel.create({
          name: fileName,
          'owner-id': req.user._id,
          version: 1.0,
          validated: await isAdmin(req.user),
          downloadable: isDownloadable === 'true',
        });
      }

      await renameFileWithVersion(filePath, '1.0');
    } else {
      const newVersion = (parseFloat(commonFileRecord.version) + 1.0).toFixed(1);
      await commonFileRecord.update({
        version: newVersion,
      });

      if (isPublic === 'true') {
        const pendingRecord = await getPendingRecord(fileName);
        if (pendingRecord) {
          await pendingRecord.update({
            version: newVersion,
            validated: await isAdmin(req.user),
            downloadable: isDownloadable === 'true',
          });
        } else {
          await ValidationModel.create({
            name: fileName,
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
    errorLog(`${err} / @postCommonFile`);
    return res.status(500).send(`無法上傳資料 ${req.body.fileName}`);
  }
};

export const getShpFile = async (req, res) => {
  try {
    const { fileName, version } = req.params;

    if (!await isTableExist(fileName))
      return res.status(400).send(`${fileName} 資料不存在`);
    if (version && !await isVersionExist(fileName, version))
      return res.status(400).send(`版本 ${version} 不存在`);
    if (!await isUserAuthorized(ShapeFileModel, fileName, req.user, version))
      return res.status(400).send(`${fileName} 無權限讀取`);

    const availVersion = await getAvailVersion(ShapeFileModel, fileName, req.user);
    const selectedVersion = version
      ? parseFloat(version).toFixed(1)
      : parseFloat(availVersion).toFixed(1);

    const filePath = path.join(__dirname, `../../../data/shp-file/${fileName}/${fileName} - v${selectedVersion}.json`);
    const data = await getDataFromFile(filePath);
    const layer = JSON.parse(data);

    return res.status(200).send(layer);
  } catch (err) {
    errorLog(`${err} / @getShpFile`);
    return res.status(500).send(`無法取得資料 ${req.params.fileName}`);
  }
};

export const getShpData = async (req, res) => {
  try {
    const { fileName, version } = req.params;

    if (!await isTableExist(fileName))
      return res.status(400).send(`${fileName} 資料不存在`);
    if (version && !await isVersionExist(fileName, version))
      return res.status(400).send(`版本 ${version} 不存在`);
    if (!await isUserAuthorized(ShapeDataModel, fileName, req.user, version))
      return res.status(400).send(`${fileName} 無權限讀取`);

    const availVersion = await getAvailVersion(ShapeDataModel, fileName, req.user);
    const result = await getTable(fileName, version || availVersion);

    return res.status(200).send(result);
  } catch (err) {
    errorLog(`${err} / @getShpData`);
    return res.status(500).send(`無法取得資料 ${req.params.fileName}`);
  }
};

export const getShpFileList = async (req, res) => {
  try {
    const publicData = await getPublicData(ShapeFileModel, req.user);
    const privateData = await getPrivateData(ShapeFileModel, req.user);
    let allData = Array.prototype.concat.apply([], [publicData, privateData]);

    allData = await Promise.all(allData.map(async (data) => {
      const shapeDataRecord = await getDataRecord(ShapeDataModel, data.name);
      return {
        ...data,
        keyPropertyName: shapeDataRecord['key-property-name'],
      };
    }));

    res
      .status(200)
      .send(allData);
  } catch (err) {
    errorLog(`${err} / @getShpFileList`);
    res.status(500).send('無法取得資料');
  }
};

export const getShpDataList = async (req, res) => {
  try {
    const publicData = await getPublicData(ShapeDataModel, req.user, ShapeFileModel);
    const privateData = await getPrivateData(ShapeDataModel, req.user, ShapeFileModel);

    res
      .status(200)
      .send(Array.prototype.concat.apply([], [publicData, privateData]));
  } catch (err) {
    errorLog(`${err} / @getShpDataList`);
    res.status(500).send('無法取得資料');
  }
};

export const getCommonFileList = async (req, res) => {
  try {
    const publicData = await getPublicData(CommonFileModel, req.user);
    const privateData = await getPrivateData(CommonFileModel, req.user);

    res
      .status(200)
      .send(Array.prototype.concat.apply([], [publicData, privateData]));
  } catch (err) {
    errorLog(`${err} / @getCommonFileList`);
    res.status(500).send('無法取得資料');
  }
};

export const getJoinedLayer = async (req, res) => {
  try {
    const { fileNames, versions } = req.query;

    // 檢查request格式&權限
    if (!fileNames)
      return res.status(400).send('請提供基本資訊');

    const tableNames = fileNames.replace(/\s/g, '').split(',');
    if (!await isShapeFileExist(tableNames[0]))
      return res.status(400).send('請在fileNames第一個提供Shapefile名稱');

    const tableVersions = versions
      ? versions.replace(/\s/g, '').split(',')
      : tableNames.map(() => null);

    for (let i = tableVersions.length; i < tableNames.length; i += 1)
      tableVersions.push(null);

    let noFileError;
    let noVersionError;
    let unauthorizedError;

    await Promise.all(tableNames.map(async (tableName, index) => {
      if (!await isTableExist(tableName)) {
        noFileError = `${tableName} 資料不存在`;
        return;
      }
      if (!await isVersionExist(tableName, tableVersions[index])) {
        noVersionError = `${tableName} 版本 ${tableVersions[index]} 不存在`;
        return;
      }
      if (!await isUserAuthorized(ShapeDataModel, tableName, req.user)) {
        unauthorizedError = `${tableName} 無權限讀取`;
      }
    }));

    if (noFileError)
      return res.status(400).send(noFileError);
    if (noVersionError)
      return res.status(400).send(noVersionError);
    if (unauthorizedError)
      return res.status(400).send(unauthorizedError);
    // ===============================

    const shapefileKey = await getTableKey(tableNames[0]);
    const shapefileVersion = tableVersions[0]
      ? parseFloat(tableVersions[0]).toFixed(1)
      : parseFloat(await getAvailVersion(ShapeFileModel, tableNames[0], req.user)).toFixed(1);

    let joinedAttr = await getJoinedTable(tableNames, tableVersions);
    joinedAttr = joinedAttr.map(({ version, ...otherAttrs }) => otherAttrs);

    const layerPath = path.join(__dirname, `../../../data/shp-file/${tableNames[0]}/${tableNames[0]} - v${shapefileVersion}.json`);
    const featureLayer = JSON.parse(await fs.promises.readFile(layerPath));

    const features = featureLayer.featureCollection.layers[0].featureSet.features.map((f) => {
      const _attr_keys = Object.keys(f.attributes);
      _attr_keys.forEach((k) => {
        f.attributes[k] = String(f.attributes[k]);
      });

      const attr = joinedAttr.find((j) => j[shapefileKey] === f.attributes[shapefileKey]);
      if (attr) {
        const __attr_keys = Object.keys(attr);
        __attr_keys.forEach((k) => {
          attr[k] = String(attr[k]);
        });

        return {
          ...f,
          attributes: attr,
        };
      }
      return f;
    });

    const { fields } = featureLayer.featureCollection.layers[0].layerDefinition;
    Object.keys(joinedAttr[0]).map((key) => {
      const existAttr = Object.keys(
        featureLayer.featureCollection.layers[0].featureSet.features[0].attributes,
      );
      const keyMatched = existAttr.find((attr) => attr === key);
      if (!keyMatched) {
        fields.push({
          name: key,
          type: parseFloat(joinedAttr[0][key]) || parseFloat(joinedAttr[0][key]) === 0 ? 'esriFieldTypeDouble' : 'esriFieldTypeString',
          alias: key,
          sqlType: 'sqlTypeOther',
          nullable: true,
          editable: true,
          domain: null,
          defaultValue: null,
        });
      }
    });

    featureLayer.featureCollection.layers[0].featureSet.features = features;
    featureLayer.featureCollection.layers[0].layerDefinition.fields = fields;

    return res.status(200).send(featureLayer);
  } catch (err) {
    errorLog(`${err} / @getJoinedLayer`);
    return res.status(500).send('無法取得資料');
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
    if (!await isUserAuthorized(ShapeFileModel, fileName, req.user, version))
      return res.status(400).send(`${fileName} 無權限讀取`);

    const availVersion = await getAvailVersion(ShapeFileModel, fileName, req.user);
    const selectedVersion = version
      ? parseFloat(version).toFixed(1)
      : parseFloat(availVersion).toFixed(1);

    const filePath = path.join(__dirname, `../../../data/shp-file/${fileName}/${fileName} - v${selectedVersion}.json`);
    const data = await getDataFromFile(filePath);
    const layer = JSON.parse(data);

    const shapeDataRecord = await getDataRecord(ShapeDataModel, fileName);
    const keyPropertyName = shapeDataRecord['key-property-name'];
    const referenceList = [];

    layer.featureCollection.layers[0].featureSet.features.map((feature) => {
      referenceList.push({
        [keyPropertyName]: feature.attributes[keyPropertyName],
        [selectedProperty]: feature.attributes[selectedProperty],
      });
    });

    return res.status(200).send(referenceList);
  } catch (err) {
    errorLog(`${err} / @getKeyPropList`);
    return res.status(500).send('無法取得資料');
  }
};

export const downloadShpFile = async (req, res) => {
  try {
    const { fileName, version } = req.params;

    if (!await isTableExist(fileName))
      return res.status(400).send(`${fileName} 資料不存在`);
    if (version && !await isVersionExist(fileName, version))
      return res.status(400).send(`版本 ${version} 不存在`);
    if (version && !await isVersionDownloadable(ShapeFileModel, req.user, fileName, version))
      return res.status(400).send(`版本 ${version} 無開放下載`);
    if (!await isUserAuthorized(ShapeFileModel, fileName, req.user, version))
      return res.status(400).send(`${fileName} 無權限讀取`);

    const isDownloadNeeded = true;
    const availVersion = await getAvailVersion(
      ShapeFileModel, fileName, req.user, isDownloadNeeded,
    );
    if (!version && !availVersion) return res.status(400).send(`${fileName} 無開放下載`);

    const selectedVersion = version
      ? parseFloat(version).toFixed(1)
      : parseFloat(availVersion).toFixed(1);

    res.setHeader(
      'Content-Type',
      'application/zip; charset=UTF-8',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment;filename*=UTF-8''${encodeURIComponent(`${fileName}.zip`)}`,
    );

    const filePath = path.join(__dirname, `../../../data/shp-file/${fileName}/${fileName} - v${selectedVersion}.zip`);
    const readStream = fs.createReadStream(filePath);
    return readStream.pipe(res);
  } catch (err) {
    errorLog(`${err} / @downloadShpFile`);
    return res.status(500).send(`無法下載資料 ${req.query.fileName}`);
  }
};

export const downloadShpData = async (req, res) => {
  try {
    const { fileName, version } = req.params;

    if (!await isTableExist(fileName))
      return res.status(400).send(`${fileName} 資料不存在`);
    if (version && !await isVersionExist(fileName, version))
      return res.status(400).send(`版本 ${version} 不存在`);
    if (version && !await isVersionDownloadable(ShapeDataModel, req.user, fileName, version))
      return res.status(400).send(`版本 ${version} 無開放下載`);
    if (!await isUserAuthorized(ShapeDataModel, fileName, req.user, version))
      return res.status(400).send(`${fileName} 無權限讀取`);

    const isDownloadNeeded = true;
    const availVersion = await getAvailVersion(
      ShapeDataModel, fileName, req.user, isDownloadNeeded,
    );
    if (!version && !availVersion) return res.status(400).send(`${fileName} 無開放下載`);

    const workbook = await writeExcel(fileName, version || availVersion);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; charset=UTF-8',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment;filename*=UTF-8''${encodeURIComponent(`${fileName}.xlsx`)}`,
    );

    return workbook.xlsx.write(res).then(() => {
      res.status(200).end();
    });
  } catch (err) {
    errorLog(`${err} / @downloadShpData`);
    return res.status(500).send(`無法下載資料 ${req.query.fileName}`);
  }
};

export const downloadCommonFile = async (req, res) => {
  try {
    const { fileName, version } = req.params;

    if (!await isCommonFileExist(fileName))
      return res.status(400).send(`${fileName} 資料不存在`);
    if (version && !await isCommonFileVersionExist(fileName, version))
      return res.status(400).send(`版本 ${version} 不存在`);
    if (version && !await isVersionDownloadable(CommonFileModel, req.user, fileName, version))
      return res.status(400).send(`版本 ${version} 無開放下載`);
    if (!await isUserAuthorized(CommonFileModel, fileName, req.user, version))
      return res.status(400).send(`${fileName} 無權限讀取`);

    const isDownloadNeeded = true;
    const availVersion = await getAvailVersion(
      CommonFileModel, fileName, req.user, isDownloadNeeded,
    );
    if (!version && !availVersion) return res.status(400).send(`${fileName} 無開放下載`);

    const selectedVersion = version
      ? parseFloat(version).toFixed(1)
      : parseFloat(availVersion).toFixed(1);

    const folderName = fileName.substr(0, fileName.lastIndexOf('.'));
    const filePath = path.join(__dirname, `../../../data/common-file/${folderName}/${fileName}`);
    const dotIndex = filePath.lastIndexOf('.');
    const filePathWithVersion = `${filePath.slice(0, dotIndex)} - v${selectedVersion}${filePath.slice(dotIndex)}`;
    const encodedFileName = encodeURIComponent(fileName);

    res.setHeader(
      'Content-Disposition',
      `attachment;filename=${encodedFileName}; filename*=UTF-8''${encodedFileName}`,
    );

    return res.download(filePathWithVersion);
  } catch (err) {
    errorLog(`${err} / @downloadCommonFile`);
    return res.status(500).send(`無法下載資料 ${req.query.fileName}`);
  }
};

export const removeShpFile = async (req, res) => {
  try {
    const { fileName, version } = req.params;

    if (!await isTableExist(fileName))
      return res.status(400).send(`${fileName} 資料不存在`);
    if (version && !await isVersionExist(fileName, version))
      return res.status(400).send(`版本 ${version} 不存在`);
    if (!await isDeleteAuthorized(ShapeFileModel, fileName, req.user))
      return res.status(400).send(`${fileName} 無權限刪除`);

    await removeTable(fileName, version);

    const folderPath = path.join(__dirname, `../../../data/shp-file/${fileName}`);
    if (version) {
      const filePath = `${folderPath}/${fileName} - v${parseFloat(version).toFixed(1)}.zip`;
      const layerPath = `${folderPath}/${fileName} - v${parseFloat(version).toFixed(1)}.json`;
      await removeFile(filePath);
      await removeFile(layerPath);

      if (!await isTableExist(fileName)) {
        await removeDataRecordAndFolder(ShapeFileModel, fileName, folderPath, ShapeDataModel);
      } else {
        const latestVersion = await getLatestVersion(fileName);
        await ShapeFileModel.update(
          { version: latestVersion },
          { where: { name: fileName } },
        );
        await ShapeDataModel.update(
          { version: latestVersion },
          { where: { name: fileName } },
        );
      }
    } else {
      await removeDataRecordAndFolder(ShapeFileModel, fileName, folderPath, ShapeDataModel);
    }

    removeValidateRecord(fileName, version);

    return res.status(200).send(`成功刪除資料  ${req.params.fileName}`);
  } catch (err) {
    errorLog(`${err} / @removeShpFile`);
    return res.status(500).send(`無法刪除資料  ${req.params.fileName}`);
  }
};

export const removeShpData = async (req, res) => {
  try {
    const { fileName, version } = req.params;

    if (!await isTableExist(fileName))
      return res.status(400).send(`${fileName} 資料不存在`);
    if (version && !await isVersionExist(fileName, version))
      return res.status(400).send(`版本 ${version} 不存在`);
    if (!await isDeleteAuthorized(ShapeDataModel, fileName, req.user))
      return res.status(400).send(`${fileName} 無權限刪除`);

    await removeTable(fileName, version);

    const folderPath = path.join(__dirname, `../../../data/shp-data/${fileName}`);
    if (version) {
      const filePath = `${folderPath}/${fileName} - v${parseFloat(version).toFixed(1)}.xlsx`;
      await removeFile(filePath);

      if (!await isTableExist(fileName)) {
        await removeDataRecordAndFolder(ShapeDataModel, fileName, folderPath);
      } else {
        const latestVersion = await getLatestVersion(fileName);
        await ShapeDataModel.update(
          { version: latestVersion },
          { where: { name: fileName } },
        );
      }
    } else {
      await removeDataRecordAndFolder(ShapeDataModel, fileName, folderPath);
    }

    removeValidateRecord(fileName, version);

    return res.status(200).send(`成功刪除資料  ${req.params.fileName}`);
  } catch (err) {
    errorLog(`${err} / @removeShpData`);
    return res.status(500).send(`無法刪除資料  ${req.params.fileName}`);
  }
};

export const removeCommonFile = async (req, res) => {
  try {
    const { fileName, version } = req.params;

    if (!await isCommonFileExist(fileName))
      return res.status(400).send(`${fileName} 資料不存在`);
    if (version && !await isCommonFileVersionExist(fileName, version))
      return res.status(400).send(`版本 ${version} 不存在`);
    if (!await isDeleteAuthorized(CommonFileModel, fileName, req.user))
      return res.status(400).send(`${fileName} 無權限讀取`);

    const folderName = fileName.substr(0, fileName.lastIndexOf('.'));
    const folderPath = path.join(__dirname, `../../../data/common-file/${folderName}`);
    const filePath = path.join(__dirname, `../../../data/common-file/${folderName}/${fileName}`);
    const dotIndex = filePath.lastIndexOf('.');
    const filePathWithVersion = `${filePath.slice(0, dotIndex)} - v${parseFloat(version).toFixed(1)}${filePath.slice(dotIndex)}`;

    if (version) {
      await removeFile(filePathWithVersion);

      if (await isFolderEmpty(folderPath)) {
        await removeDataRecordAndFolder(CommonFileModel, fileName, folderPath);
      } else {
        const latestVersion = await getCommonFileLatestVersion(folderPath);
        await CommonFileModel.update(
          { version: latestVersion },
          { where: { name: fileName } },
        );
      }
    } else {
      await removeDataRecordAndFolder(CommonFileModel, fileName, folderPath);
    }

    removeValidateRecord(fileName, version);

    return res.status(200).send(`成功刪除資料  ${req.params.fileName}`);
  } catch (err) {
    errorLog(`${err} / @removeCommonFile`);
    return res.status(500).send(`無法刪除資料  ${req.params.fileName}`);
  }
};
