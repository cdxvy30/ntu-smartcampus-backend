import {
  getDataRecord,
  getPublicData,
  getPrivateData,
  isSensorProjectExist,
  isSensorExist,
  removeValidateRecord,
} from '../../util/general';
import {
  createTable,
  removeTable,
  isTableEmpty,
  bulkInsert,
  updateData,
  removeData,
  getTableWithoutVersion,
} from '../../util/database';
import {
  isAdmin,
  isOwner,
  isUserAuthorized,
  isUploadAuthorized,
  isDeleteAuthorized,
} from '../../util/authorize';
import { SensorModel, SensorDataSchema } from './SensorDataModel';
import { ValidationModel } from '../Admin/AdminModel';
import logger from '../../logger';

const errorLog = (message) => {
  logger.error(`[SensorDataController] ${message}`);
};

export const postSensorProject = async (req, res) => {
  try {
    const { sensorProjectName, isPublic, description } = req.body;

    // 檢查request
    if (!(sensorProjectName && isPublic && description))
      return res.status(400).send('請提供基本資訊 (name, isPublic, description)');
    if (!(await isUploadAuthorized(SensorModel, sensorProjectName, req.user)))
      return res.status(400).send(`已存在命名為 "${sensorProjectName}" 之資料，請更換名稱`);
    if (await isSensorProjectExist(sensorProjectName))
      return res.status(400).send(`已存在命名為 "${sensorProjectName}" 之 SensorProject，請更換名稱`);

    await SensorModel.create({
      name: sensorProjectName,
      'owner-id': req.user._id,
      version: 1.0,
      public: isPublic === 'true',
      description,
    });
    await createTable(sensorProjectName, SensorDataSchema);

    return res.status(200).send(`已成功新增 SensorProject "${sensorProjectName}"`);
  } catch (err) {
    errorLog(`${err} / @postSensorProject`);
    return res.status(500).send(`無法新增 SensorProject "${req.body.sensorProjectName}"`);
  }
};

export const postSensorInstance = async (req, res) => {
  try {
    const {
      sensorName, bindingSensorProject, url, date, query, contentType, body, X, Y, response,
    } = req.body;

    // 檢查request
    if (!(sensorName && url && date && query && contentType && body && X && Y && response))
      return res.status(400).send('請提供基本資訊 (name, url, date, query, contentType, body, X, Y, response)');
    if (!(await isSensorProjectExist(bindingSensorProject)))
      return res.status(400).send(`SensorProject "${bindingSensorProject}" 不存在`);
    if (await isSensorExist(bindingSensorProject, sensorName))
      return res.status(400).send(`已存在命名為 "${sensorName}" 之 Sensor，請更換名稱後上傳`);

    const sensorProjectRecord = await SensorModel.findOne({
      where: { name: bindingSensorProject },
    });

    if (!(await isAdmin(req.user) || await isOwner(req.user, sensorProjectRecord)))
      return res.status(400).send(`無權限上傳 SensorProject "${bindingSensorProject}" 裡的 Sensor`);

    await bulkInsert(bindingSensorProject, SensorDataSchema, [
      {
        name: sensorName,
        url,
        date,
        query,
        'content-type': contentType,
        body,
        X,
        Y,
        response,
      },
    ]);

    if (sensorProjectRecord.public) {
      const validationRecord = await ValidationModel.findOne({
        where: { name: bindingSensorProject },
      });

      if (!validationRecord) {
        await ValidationModel.create({
          name: bindingSensorProject,
          'owner-id': req.user._id,
          version: 1.0,
          validated: await isAdmin(req.user),
          downloadable: 'false',
        });
      } else {
        validationRecord.update({
          validated: 'false',
        });
      }
    }

    return res.status(200).send(`已成功新增 Sensor "${sensorName}"`);
  } catch (err) {
    errorLog(`${err} / @postSensorInstance`);
    return res.status(500).send(`無法新增 Sensor "${req.body.sensorName}"`);
  }
};

export const updateSensorProject = async (req, res) => {
  try {
    const { sensorProjectName, isPublic, description } = req.body;

    // 檢查request
    if (!(sensorProjectName && isPublic && description))
      return res.status(400).send('請提供基本資訊 (name, isPublic, description)');
    if (!(await isSensorProjectExist(sensorProjectName)))
      return res.status(400).send(`SensorProject "${sensorProjectName}" 不存在`);

    const sensorProjectRecord = await getDataRecord(SensorModel, sensorProjectName);

    if (!(await isAdmin(req.user) || await isOwner(req.user, sensorProjectRecord)))
      return res.status(400).send(`無權限修改名為 "${sensorProjectName}" 的 SensorProject`);

    await sensorProjectRecord.update({
      name: sensorProjectName,
      'owner-id': req.user._id,
      version: 1.0,
      public: isPublic === 'true',
      description,
    });

    const validationRecord = await ValidationModel.findOne({
      where: { name: sensorProjectName },
    });

    if (validationRecord && isPublic !== 'true') {
      removeValidateRecord(sensorProjectName);
      return res.status(200).send(`已成功修改 SensorProject "${sensorProjectName}"`);
    }

    if (validationRecord && isPublic === 'true') {
      validationRecord.update({
        validated: 'false',
      });
      return res.status(200).send(`已成功修改 SensorProject "${sensorProjectName}"`);
    }

    if (!validationRecord && isPublic === 'true') {
      await ValidationModel.create({
        name: sensorProjectName,
        'owner-id': req.user._id,
        version: 1.0,
        validated: await isAdmin(req.user),
        downloadable: 'false',
      });
    }

    return res.status(200).send(`已成功修改 SensorProject "${sensorProjectName}"`);
  } catch (err) {
    errorLog(`${err} / @updateSensorProject`);
    return res.status(500).send(`無法修改 SensorProject "${req.body.sensorProjectName}"`);
  }
};

export const updateSensorInstance = async (req, res) => {
  try {
    const {
      sensorName, bindingSensorProject, url, date, query, contentType, body, X, Y, response,
    } = req.body;

    // 檢查request
    if (!(sensorName && url && date && query && contentType && body && X && Y && response))
      return res.status(400).send('請提供基本資訊 (name, url, date, query, contentType, body, X, Y, response)');
    if (!(await isSensorProjectExist(bindingSensorProject)))
      return res.status(400).send(`SensorProject "${bindingSensorProject}" 不存在`);
    if (!(await isSensorExist(bindingSensorProject, sensorName)))
      return res.status(400).send(`Sensor "${sensorName}" 不存在`);

    const sensorProjectRecord = await SensorModel.findOne({
      where: { name: bindingSensorProject },
    });

    if (!(await isAdmin(req.user) || await isOwner(req.user, sensorProjectRecord)))
      return res.status(400).send(`無權限修改 SensorProject "${bindingSensorProject}" 裡的 Sensor`);

    await updateData(bindingSensorProject,
      {
        name: sensorName,
        url,
        date,
        query,
        'content-type': contentType,
        body,
        X,
        Y,
        response,
      });

    if (!sensorProjectRecord.public)
      return res.status(200).send(`已成功修改 Sensor "${sensorName}"`);

    const validationRecord = await ValidationModel.findOne({
      where: { name: bindingSensorProject },
    });

    if (!validationRecord) {
      await ValidationModel.create({
        name: sensorProjectRecord.name,
        'owner-id': req.user._id,
        version: 1.0,
        validated: await isAdmin(req.user),
        downloadable: 'false',
      });
    } else {
      validationRecord.update({
        validated: 'false',
      });
    }

    return res.status(200).send(`已成功修改 Sensor "${sensorName}"`);
  } catch (err) {
    errorLog(`${err} / @updateSensorInstance`);
    return res.status(500).send(`無法修改 Sensor "${req.body.sensorName}"`);
  }
};

export const getSensorProjectList = async (req, res) => {
  try {
    const publicData = await getPublicData(SensorModel, req.user);
    const privateData = await getPrivateData(SensorModel, req.user);

    res
      .status(200)
      .send(Array.prototype.concat.apply([], [publicData, privateData]));
  } catch (err) {
    errorLog(`${err} / @getSensorProjectList`);
    res.status(500).send('無法取得資料');
  }
};

export const getSensorInstances = async (req, res) => {
  try {
    const { sensorProjectName } = req.params;

    if (!await isSensorProjectExist(sensorProjectName))
      return res.status(400).send(`SensorProject "${sensorProjectName}" 不存在`);
    if (!await isUserAuthorized(SensorModel, sensorProjectName, req.user))
      return res.status(400).send(`SensorProject "${sensorProjectName}" 無權限讀取`);

    const result = await getTableWithoutVersion(sensorProjectName);

    return res.status(200).send(result);
  } catch (err) {
    errorLog(`${err} / @getSensorInstanceList`);
    return res.status(500).send('無法取得資料');
  }
};

export const getSensorInstance = async (req, res) => {
  try {
    const { sensorProjectName, sensorName } = req.params;

    if (!await isSensorProjectExist(sensorProjectName))
      return res.status(400).send(`SensorProject "${sensorProjectName}" 不存在`);
    if (!(await isSensorExist(sensorProjectName, sensorName)))
      return res.status(400).send(`Sensor "${sensorName}" 不存在`);
    if (!await isUserAuthorized(SensorModel, sensorProjectName, req.user))
      return res.status(400).send(`SensorProject "${sensorProjectName}" 無權限讀取`);

    let result = await getTableWithoutVersion(sensorProjectName);
    result = result.filter((r) => r.name === sensorName);

    return res.status(200).send(result[0]);
  } catch (err) {
    errorLog(`${err} / @getSensorInstance`);
    return res.status(500).send('無法取得資料');
  }
};

export const removeSensorProject = async (req, res) => {
  try {
    const { sensorProjectName } = req.params;

    if (!(await isSensorProjectExist(sensorProjectName)))
      return res.status(400).send(`SensorProject "${sensorProjectName}" 不存在`);
    if (!(await isDeleteAuthorized(SensorModel, sensorProjectName, req.user)))
      return res.status(400).send(`"${sensorProjectName}" 無權限刪除`);

    await removeTable(sensorProjectName);
    await SensorModel.destroy({
      where: { name: sensorProjectName },
    });

    removeValidateRecord(sensorProjectName);

    return res.status(200).send(`成功刪除SensorProject "${sensorProjectName}"`);
  } catch (err) {
    errorLog(`${err} / @removeSensorProject`);
    return res.status(500).send(`無法刪除SensorProject  "${req.params.sensorProjectName}"`);
  }
};

export const removeSensorInstance = async (req, res) => {
  try {
    const { sensorProjectName, sensorName } = req.params;

    if (!(await isSensorProjectExist(sensorProjectName)))
      return res.status(400).send(`SensorProject "${sensorProjectName}" 不存在`);
    if (!(await isSensorExist(sensorProjectName, sensorName)))
      return res.status(400).send(`Sensor "${sensorName}" 不存在`);
    if (!(await isDeleteAuthorized(SensorModel, sensorProjectName, req.user)))
      return res.status(400).send(`"${SensorModel}" 無權限刪除`);

    await removeData(sensorProjectName, 'name', sensorName);

    if (!(await isTableEmpty(sensorProjectName)))
      return res.status(200).send(`成功刪除Sensor "${sensorName}"`);

    const sensorProjectRecord = await SensorModel.findOne({
      where: { name: sensorProjectName },
    });

    if (!sensorProjectRecord.public)
      return res.status(200).send(`成功刪除Sensor "${sensorName}"`);

    const validationRecord = await ValidationModel.findOne({
      where: { name: sensorProjectName },
    });

    if (!validationRecord)
      return res.status(200).send(`成功刪除Sensor "${sensorName}"`);

    validationRecord.update({
      validated: 'false',
    });

    return res.status(200).send(`成功刪除Sensor "${sensorName}"`);
  } catch (err) {
    errorLog(`${err} / @removeSensorInstance`);
    return res.status(500).send(`無法刪除Sensor  "${req.params.sensorName}"`);
  }
};
