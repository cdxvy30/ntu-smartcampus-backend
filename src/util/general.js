import * as rimraf from 'rimraf';
import * as path from 'path';
import * as fs from 'fs';
import { ShapeFileModel, ShapeDataModel, CommonFileModel } from '../api/ShpData/ShpDataModel';
import { isAdmin, isOwner } from './authorize';
import { ValidationModel } from '../api/Admin/AdminModel';
import { UserModel } from '../api/User/UserModel';
import { PointDataModel } from '../api/PointData/PointDataModel';
import { SensorModel } from '../api/SensorData/SensorDataModel';
import { isDataExist } from './database';
import { PublishModel } from '../api/Publish/PublishModel';

export const isFolderEmpty = async (folderPath) => fs.readdirSync(folderPath).length === 0;

export const isLatestVersionValidated = async (file) => {
  try {
    const validateRecord = await ValidationModel.findOne({
      where: { name: file.name, validated: true },
      order: [['version', 'DESC']],
    });

    return validateRecord && validateRecord.version === file.version;
  } catch (err) {
    throw `${err} / @general.isLatestVersionValidated`;
  }
};

export const isKeyPropertyValueExist = async (model, bindingShpName, user, keyPropertyValue) => {
  let availVersion = await getAvailVersion(model, bindingShpName, user);
  availVersion = parseFloat(availVersion).toFixed(1);

  const data = await fs.promises.readFile(
    path.join(__dirname, `../../data/shp-file/${bindingShpName}/${bindingShpName} - v${availVersion}.json`),
  );
  const layer = JSON.parse(data);

  const shapeDataRecord = await ShapeDataModel.findOne({
    where: { name: bindingShpName },
  });

  let isValueExist = false;
  layer.featureCollection.layers[0].featureSet.features.map((feature) => {
    if (keyPropertyValue === feature.attributes[shapeDataRecord['key-property-name']])
      isValueExist = true;
  });

  return isValueExist;
};

export const isSensorProjectExist = async (name) => (
  SensorModel.findOne({
    where: { name },
  })
);

export const isSensorExist = async (bindingSensorProject, name) => {
  const result = await isDataExist(bindingSensorProject, 'name', name);
  return result;
};

export const isShapeFileExist = async (fileName) => (
  ShapeFileModel.findOne({
    where: { name: fileName },
  })
);

export const isCommonFileExist = async (fileName) => (
  CommonFileModel.findOne({
    where: { name: fileName },
  })
);

export const isCommonFileVersionExist = async (fileName, version) => {
  if (!version) return true;

  const folderName = fileName.substr(0, fileName.lastIndexOf('.'));
  const filePath = path.join(__dirname, `../../data/common-file/${folderName}/${fileName}`);
  const dotIndex = filePath.lastIndexOf('.');
  const newFilePath = `${filePath.slice(0, dotIndex)} - v${parseFloat(version).toFixed(1)}${filePath.slice(dotIndex)}`;

  return fs.existsSync(newFilePath);
};

export const isVersionDownloadable = async (model, user, fileName, version) => {
  try {
    const data = await model.findOne({
      where: { name: fileName },
    });

    if (await isAdmin(user) || await isOwner(user, data))
      return true;

    const validateData = await ValidationModel.findOne({
      where: { name: fileName, version },
    });

    if (validateData && validateData.downloadable)
      return true;

    return false;
  } catch (err) {
    throw `${err} / @general.isVersionDownloadable`;
  }
};

export const getDataFromFile = async (filePath) => {
  try {
    return await fs.promises.readFile(filePath, 'utf8');
  } catch (err) {
    throw `${err} / @general.getDataFromFile`;
  }
};

export const getDataRecord = async (model, fileName) => {
  try {
    return await model.findOne({
      where: { name: fileName },
    });
  } catch (err) {
    throw `${err} / @general.getDataRecord`;
  }
};

export const getPendingRecord = async (fileName) => {
  try {
    const ValidatedRecord = await ValidationModel.findOne({
      where: { name: fileName, validated: true },
      order: [['version', 'DESC']],
    });

    const PendingRecord = await ValidationModel.findOne({
      where: { name: fileName, validated: false },
      order: [['version', 'DESC']],
    });

    if (!PendingRecord)
      return false;

    if (ValidatedRecord && PendingRecord.version <= ValidatedRecord.version)
      return false;

    return PendingRecord;
  } catch (err) {
    throw `${err} / @general.getPendingRecord`;
  }
};

export const getDataInfo = async (model, shapeFileModel = null) => {
  try {
    const data = await model.findAll({ raw: true });
    const dataInfoArray = [];

    let dataType = 'shapeFile';
    if (model === ShapeDataModel) dataType = 'shapeData';
    if (model === PointDataModel) dataType = 'pointData';
    if (model === CommonFileModel) dataType = 'commonFile';
    if (model === SensorModel) dataType = 'sensorProject';

    await Promise.all(data.map(async (f) => {
      if (shapeFileModel && await shapeFileModel.findOne({ where: { name: f.name } }))
        return;

      const user = await UserModel.findOne({
        where: { _id: f['owner-id'] },
      });

      const dataInfo = {
        ...f,
        owner: user.displayName,
        type: dataType,
      };

      if (dataType === 'shapeFile') {
        const shapeDataRecord = await ShapeDataModel.findOne({ where: { name: f.name } });
        dataInfo['key-property-name'] = shapeDataRecord['key-property-name'];
      }

      dataInfoArray.push(dataInfo);
    }));

    return dataInfoArray;
  } catch (err) {
    throw `${err} / @general.getDataInfo`;
  }
};

export const getPendingDataInfo = async (model, shapeFileModel = null) => {
  try {
    const data = await model.findAll({ where: { public: true }, raw: true });
    const dataInfoArray = [];

    let dataType = 'shapeFile';
    if (model === ShapeDataModel) dataType = 'shapeData';
    if (model === PointDataModel) dataType = 'pointData';
    if (model === CommonFileModel) dataType = 'commonFile';
    if (model === SensorModel) dataType = 'sensorProject';

    await Promise.all(data.map(async (f) => {
      if (shapeFileModel && await shapeFileModel.findOne({ where: { name: f.name } }))
        return;

      if (await isLatestVersionValidated(f)) return;

      const user = await UserModel.findOne({
        where: { _id: f['owner-id'] },
        raw: true,
      });

      const dataInfo = {
        ...f,
        owner: user.displayName,
        type: dataType,
      };

      if (dataType === 'shapeFile') {
        const shapeDataRecord = await ShapeDataModel.findOne({ where: { name: f.name } });
        dataInfo['key-property-name'] = shapeDataRecord['key-property-name'];
      }

      dataInfoArray.push(dataInfo);
    }));

    return dataInfoArray;
  } catch (err) {
    throw `${err} / @general.getPendingDataInfo`;
  }
};

export const getCommonFileLatestVersion = async (folderPath) => {
  try {
    const fileNames = await fs.promises.readdir(folderPath);
    let maxVersion = 0;

    fileNames.map((fileName) => {
      const versionStrLength = fileName.lastIndexOf('.') - fileName.lastIndexOf('- v') - 3;
      const version = fileName.substr(fileName.lastIndexOf('- v') + 3, versionStrLength);
      if (parseFloat(version) > maxVersion)
        maxVersion = parseFloat(version);
    });

    return maxVersion;
  } catch (err) {
    throw `${err} / @general.getCommonFileLatestVersion`;
  }
};

export const getPublicData = async (model, user, shapeFileModel = null) => {
  try {
    const availData = [];
    const publicData = await model.findAll({
      where: { public: true },
      raw: true,
    });

    if (model === SensorModel) {
      return publicData;
    }

    await Promise.all(publicData.map(async (data) => {
      if (shapeFileModel && await shapeFileModel.findOne({ where: { name: data.name } }))
        return;

      if (await isAdmin(user) || await isOwner(user, data)) {
        availData.push({
          ...data,
          downloadable: true,
        });
        return;
      }

      const validatedRecord = await ValidationModel.findOne({
        where: { name: data.name, validated: true },
        order: [['version', 'DESC']],
      });

      if (validatedRecord) {
        availData.push({
          ...data,
          version: validatedRecord.version,
          downloadable: validatedRecord.downloadable,
        });
      }
    }));

    return availData;
  } catch (err) {
    throw `${err} / @general.getPublicData`;
  }
};

export const getPrivateData = async (model, user, shapeFileModel = null) => {
  try {
    const availData = [];
    const privateData = await model.findAll({
      where: { public: false },
      raw: true,
    });

    await Promise.all(privateData.map(async (data) => {
      if (shapeFileModel && await shapeFileModel.findOne({ where: { name: data.name } }))
        return;

      if (await isAdmin(user) || await isOwner(user, data))
        availData.push({
          ...data,
          downloadable: model !== SensorModel,
        });
    }));

    return availData;
  } catch (err) {
    throw `${err} / @general.getPrivateData`;
  }
};

export const getAvailVersion = async (model, fileName, user, isDownloadNeeded = false) => {
  try {
    const data = await model.findOne({
      where: { name: fileName },
    });

    if (await isAdmin(user) || await isOwner(user, data))
      return data.version;

    const condition = isDownloadNeeded
      ? { name: fileName, validated: true, downloadable: true }
      : { name: fileName, validated: true };

    const validatedRecord = await ValidationModel.findOne({
      where: condition,
      order: [['version', 'DESC']],
    });

    if (validatedRecord)
      return validatedRecord.version;

    return false;
  } catch (err) {
    throw `${err} / @general.getAvailVersion`;
  }
};

export const updateUserValidate = async (username) => {
  try {
    let user = await UserModel.findOne({
      where: { username },
    });

    if (!user) return false;

    user = await user.update(
      { validated: true },
    );

    return user;
  } catch (err) {
    throw `${err} / @general.updateUserValidate`;
  }
};

export const updateDataValidate = async (fileName) => {
  try {
    const validatedRecord = await ValidationModel.findOne({
      where: { name: fileName },
      order: [['version', 'DESC']],
    });

    if (!validatedRecord) return 'No Record';
    if (validatedRecord.validated) return 'Already Validated';

    const result = await validatedRecord.update({
      validated: true,
    });

    return result;
  } catch (err) {
    throw `${err} / @general.updateDataValidate`;
  }
};

export const updatePublishValidate = async (id) => {
  try {
    let publishRecord = await PublishModel.findOne({
      where: { id },
    });

    if (!publishRecord) return false;

    publishRecord = await publishRecord.update(
      { status: 'Handling', message: '發佈處理中' },
    );

    return publishRecord;
  } catch (err) {
    throw `${err} / @general.updatePublishValidate`;
  }
};

export const removeFile = async (filePath) => {
  try {
    await fs.unlinkSync(filePath);
  } catch (err) {
    throw `${err} / @general.removeFile`;
  }
};

export const removeDataRecord = async (model, fileName, shapeDataModel = null) => {
  await model.destroy({
    where: { name: fileName },
  });

  if (shapeDataModel) {
    await shapeDataModel.destroy({
      where: { name: fileName },
    });
  }
};

export const removeDataRecordAndFolder = async (
  model, fileName, folderPath, shapeDataModel = null,
) => {
  try {
    await removeDataRecord(model, fileName, shapeDataModel);
    await rimraf.sync(folderPath);

    return;
  } catch (err) {
    throw `${err} / @general.removeDataRecordAndFolder`;
  }
};

export const removeValidateRecord = async (fileName, version) => {
  try {
    if (version) {
      await ValidationModel.destroy({
        where: { name: fileName, version },
      });
    } else {
      await ValidationModel.destroy({
        where: { name: fileName },
      });
    }

    return;
  } catch (err) {
    throw `${err} / @general.removePendingValidateRecord`;
  }
};

export const removePendingValidateRecord = async (fileName) => {
  try {
    await ValidationModel.destroy({
      where: { name: fileName, validated: false },
    });

    return;
  } catch (err) {
    throw `${err} / @general.removePendingValidateRecord`;
  }
};

export const removePendingUserRecord = async (username) => {
  try {
    await UserModel.destroy({
      where: { username },
    });

    return;
  } catch (err) {
    throw `${err} / @general.removePendingUserRecord`;
  }
};

export const createFolderIfNotExist = async (folderPath) => {
  try {
    if (!fs.existsSync(folderPath))
      fs.mkdirSync(folderPath, { recursive: true });
  } catch (err) {
    throw `${err} / @general.createFolderIfNotExist`;
  }
};

export const saveFileToFolder = async (file, filePath) => {
  try {
    await file.mv(filePath);
  } catch (err) {
    throw `${err} / @general.saveFileToFolder`;
  }
};

export const saveLayerToFolder = async (filePath, layer) => {
  try {
    fs.writeFileSync(
      filePath.replace('.zip', '.json'),
      JSON.stringify(layer),
    );
  } catch (err) {
    throw `${err} / @general.saveLayerToFolder`;
  }
};

export const renameFileWithVersion = async (filePath, version) => {
  try {
    const dotIndex = filePath.lastIndexOf('.');
    const newFilePath = `${filePath.slice(0, dotIndex)} - v${version}${filePath.slice(dotIndex)}`;
    await fs.promises.rename(filePath, newFilePath);
  } catch (err) {
    throw `${err} / @general.renameFileWithVersion`;
  }
};

export const renameLayerWithVersion = async (filePath, version) => {
  try {
    const dotIndex = filePath.lastIndexOf('.');
    const newFilePath = `${filePath.slice(0, dotIndex)} - v${version}${filePath.slice(dotIndex)}`;
    await fs.promises.rename(filePath.replace('.zip', '.json'), newFilePath.replace('.zip', '.json'));
  } catch (err) {
    throw `${err} / @general.renameLayerWithVersion`;
  }
};

export const turnDataToPrivate = async (fileName, version) => {
  let data = await ShapeFileModel.findOne({ where: { name: fileName, version } });
  if (!data) data = await ShapeDataModel.findOne({ where: { name: fileName, version } });
  if (!data) data = await PointDataModel.findOne({ where: { name: fileName, version } });
  if (!data) data = await CommonFileModel.findOne({ where: { name: fileName, version } });

  await data.update({
    public: false,
  });
};
