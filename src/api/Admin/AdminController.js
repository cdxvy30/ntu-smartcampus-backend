import {
  getDataInfo,
  getPendingDataInfo,
  getPendingRecord,
  turnDataToPrivate,
  updateUserValidate,
  updateDataValidate,
  updatePublishValidate,
  removePendingUserRecord,
  removePendingValidateRecord,
} from '../../util/general';
import { ShapeFileModel, ShapeDataModel, CommonFileModel } from '../ShpData/ShpDataModel';
import { PointDataModel } from '../PointData/PointDataModel';
import { UserModel } from '../User/UserModel';
import { isAdmin } from '../../util/authorize';
import { sendEmail } from '../../util/sendgrid';
import logger from '../../logger';
import { SensorModel } from '../SensorData/SensorDataModel';
import { PublishModel } from '../Publish/PublishModel';
import { publishService } from '../Publish/PublishController';
import { decrypt } from '../../util/crypto';

const errorLog = (message) => {
  logger.error(`[AdminController] ${message}`);
};

export const getAllData = async (req, res) => {
  try {
    if (!await isAdmin(req.user))
      return res.status(400).send('無管理者權限，取得資料');

    const shapeFileInfo = await getDataInfo(ShapeFileModel);
    const shapeDataInfo = await getDataInfo(ShapeDataModel, ShapeFileModel);
    const pointDataInfo = await getDataInfo(PointDataModel);
    const commonFileInfo = await getDataInfo(CommonFileModel);
    const sensorProjectInfo = await getDataInfo(SensorModel);

    return res.status(200).send(
      [].concat(shapeFileInfo, shapeDataInfo, pointDataInfo, commonFileInfo, sensorProjectInfo),
    );
  } catch (err) {
    errorLog(`${err} / @getAllDataList`);
    return res.status(500).send('無法取得資料');
  }
};

export const getPendingData = async (req, res) => {
  try {
    if (!await isAdmin(req.user))
      return res.status(400).send('無管理者權限，取得資料');

    const shapefileInfo = await getPendingDataInfo(ShapeFileModel);
    const shapeDataInfo = await getPendingDataInfo(ShapeDataModel, ShapeFileModel);
    const pointDataInfo = await getPendingDataInfo(PointDataModel);
    const commonFileInfo = await getPendingDataInfo(CommonFileModel);
    const sensorProjectInfo = await getPendingDataInfo(SensorModel);

    return res.status(200).send(
      [].concat(shapefileInfo, shapeDataInfo, pointDataInfo, commonFileInfo, sensorProjectInfo),
    );
  } catch (err) {
    errorLog(`${err} / @getPendingDataList`);
    return res.status(500).send('無法取得資料');
  }
};

export const getAllUsers = async (req, res) => {
  try {
    if (!await isAdmin(req.user))
      return res.status(400).send('無管理者權限，取得資料');

    const users = await UserModel.findAll({
      where: { role: 'user' },
    });

    return res.status(200).send(users);
  } catch (err) {
    errorLog(`${err} / @getAllUsers`);
    return res.status(500).send('無法取得使用者');
  }
};

export const getPendingUsers = async (req, res) => {
  try {
    if (!await isAdmin(req.user))
      return res.status(400).send('無管理者權限，取得資料');

    const users = await UserModel.findAll({
      where: { role: 'user', validated: false },
    });

    return res.status(200).send(users);
  } catch (err) {
    errorLog(`${err} / @getPendingUsers`);
    return res.status(500).send('無法取得使用者');
  }
};

export const getPendingPublish = async (req, res) => {
  try {
    if (!await isAdmin(req.user))
      return res.status(400).send('無管理者權限，取得發佈資訊');

    const publishRecords = await PublishModel.findAll({
      attributes: { exclude: ['arcgis-password'] },
      where: { status: 'Pending' },
    });

    return res.status(200).send(publishRecords);
  } catch (err) {
    errorLog(`${err} / @getPendingPublish`);
    return res.status(500).send('無法取得發佈資訊');
  }
};

export const validateData = async (req, res) => {
  try {
    const { fileName } = req.body;

    if (!(fileName))
      return res.status(400).send('請提供基本資訊');
    if (!await isAdmin(req.user))
      return res.status(400).send('無管理者權限，無法授權資料');

    const validateRecord = await updateDataValidate(fileName);

    if (validateRecord === 'No Record')
      return res.status(500).send('無法認證資料');
    if (validateRecord === 'Already Validated')
      return res.status(500).send('資料已認證，無須再認證');

    const user = await UserModel.findOne({
      where: { _id: validateRecord['owner-id'] },
    });

    if (user) {
      await sendEmail(
        user.email,
        'SDGs CAMPUS: 資料已通過權限認證',
        'accept',
        `<strong>資料 "${validateRecord.name}" 已通過權限認證, 將成為開放資料，供平台其他使用者使用。<br />
          File "${validateRecord.name}" has been confirmed to serve as public data.</strong>`,
      );
    }

    await removePendingValidateRecord(fileName);

    return res.status(200).send(validateRecord);
  } catch (err) {
    errorLog(`${err} / @validateData`);
    return res.status(500).send('無法認證資料');
  }
};

export const validateUser = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username)
      return res.status(400).send('請提供基本資訊');
    if (!await isAdmin(req.user))
      return res.status(400).send('無管理者權限，無法授權使用者');

    const user = await updateUserValidate(username);

    if (!user) return res.status(400).send('無此使用者');

    await sendEmail(
      user.email,
      'SDGs CAMPUS: 使用者認證已通過',
      'accept',
      '使用者認證已通過, 請開始使用SDGs CAMPUS。<br />User application has been accepted, Welcome to SDGs CAMPUS.<br /></strong>',
    );

    return res.status(200).send(user);
  } catch (err) {
    errorLog(`${err} / @validateUser`);
    return res.status(500).send('無法認證使用者');
  }
};

export const validatePublish = async (req, res) => {
  try {
    const { publishId } = req.body;

    if (!publishId)
      return res.status(400).send('請提供基本資訊');
    if (!await isAdmin(req.user))
      return res.status(400).send('無管理者權限，無法授權發佈');
    if (!req.files || Object.keys(req.files).length === 0)
      return res.status(400).send('請上傳檔案');

    const publishRecord = await updatePublishValidate(publishId);

    if (!publishRecord) return res.status(400).send('無此發佈紀錄');

    req.body.existId = publishRecord.id;
    req.body.arcgisUser = publishRecord['arcgis-user'];
    req.body.arcgisPassword = decrypt(JSON.parse(publishRecord['arcgis-password']));
    req.body.arcgisPortal = publishRecord['arcgis-portal'];
    req.body.serviceName = publishRecord['service-name'];
    req.body.fileNames = publishRecord['file-names'];

    await publishService(req, res);
    return true;
  } catch (err) {
    errorLog(`${err} / @validatePublish`);
    return res.status(500).send('無法認證發佈');
  }
};

export const cancelDataApplication = async (req, res) => {
  try {
    const { fileName } = req.body;

    if (!(fileName))
      return res.status(400).send('請提供基本資訊');
    if (!await isAdmin(req.user))
      return res.status(400).send('無管理者權限，無法授權資料');

    const pendingRecord = await getPendingRecord(fileName);

    if (!pendingRecord)
      return res.status(500).send(`無 ${fileName} 的認證申請`);

    const user = await UserModel.findOne({
      where: { _id: pendingRecord['owner-id'] },
    });

    await turnDataToPrivate(fileName, pendingRecord.version);
    await removePendingValidateRecord(fileName);

    if (user) {
      await sendEmail(
        user.email,
        'SDGs CAMPUS: 資料未通過權限認證',
        'accept',
        `<strong>資料 "${pendingRecord.name}" 未通過權限認證。<br />
          File "${pendingRecord.name}" has been declined to serve as public data.</strong>`,
      );
    }

    return res.status(200).send(`已拒絕資料 ${fileName} 的認證申請`);
  } catch (err) {
    errorLog(`${err} / @validateData`);
    return res.status(500).send('無法拒絕資料認證');
  }
};

export const cancelUserApplication = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username)
      return res.status(400).send('請提供基本資訊');
    if (!await isAdmin(req.user))
      return res.status(400).send('無管理者權限，無法授權使用者');

    const user = await UserModel.findOne({
      where: { username },
    });

    if (!user) return res.status(400).send('無此使用者');

    await removePendingUserRecord(username);

    await sendEmail(
      user.email,
      'SDGs CAMPUS: 使用者認證未通過',
      'accept',
      `<strong>使用者認證未通過。<br /> 
        User application has been declined.</strong > `,
    );

    return res.status(200).send(user);
  } catch (err) {
    errorLog(`${err} / @validateUser`);
    return res.status(500).send('無法認證使用者');
  }
};

export const cancelPublishApplication = async (req, res) => {
  try {
    const { publishId } = req.body;

    if (!publishId)
      return res.status(400).send('請提供基本資訊');
    if (!await isAdmin(req.user))
      return res.status(400).send('無管理者權限，無法授權發佈');

    let publishRecord = await PublishModel.findOne({
      where: { publishId },
    });

    if (!publishRecord) return res.status(400).send('無此發佈紀錄');

    publishRecord = await publishRecord.update(
      { status: 'Canceled', message: '管理員認證未通過，已取消發佈' },
    );

    return res.status(200).send(publishRecord);
  } catch (err) {
    errorLog(`${err} / @cancelPublishApplication`);
    return res.status(500).send('無法認證發佈');
  }
};
