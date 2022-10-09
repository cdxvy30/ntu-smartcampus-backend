import * as requestIp from 'request-ip';
import * as geoip from 'geoip-country';
import { ShapeFileModel, ShapeDataModel, CommonFileModel } from '../api/ShpData/ShpDataModel';
import { PointDataModel } from '../api/PointData/PointDataModel';
import { SensorModel } from '../api/SensorData/SensorDataModel';
import { ValidationModel } from '../api/Admin/AdminModel';

export const isAdmin = async (user) => user.role === 'admin';

export const isOwner = async (user, data) => data['owner-id'] === user._id;

export const isUserAuthorized = async (model, tableName, user, version) => {
  try {
    const data = await model.findOne({
      where: { name: tableName },
    });

    if (await isAdmin(user)) return true;
    if (await isOwner(user, data)) return true;

    if (version) {
      const validatedRecord = await ValidationModel.findOne({
        where: { name: data.name, validated: true, version },
      });

      if (validatedRecord) return true;
      return false;
    }

    const validatedRecord = await ValidationModel.findOne({
      where: { name: data.name, validated: true },
      order: [['version', 'DESC']],
    });

    if (validatedRecord) return true;
    return false;
  } catch (error) {
    throw `${error} / @authorize.isUserAuthorized`;
  }
};

export const isUploadAuthorized = async (model, tableName, user) => {
  try {
    const modelList = model === ShapeFileModel
      ? [ShapeFileModel, PointDataModel, CommonFileModel, SensorModel]
      : [ShapeFileModel, ShapeDataModel, PointDataModel, CommonFileModel, SensorModel];

    let authorized = true;
    await Promise.all(modelList.map(async (m) => {
      const data = await m.findOne({
        where: { name: tableName },
      });

      if (data && model !== m) authorized = false;
      if (data && !(await isAdmin(user) || await isOwner(user, data))) authorized = false;
    }));

    return authorized;
  } catch (error) {
    throw `${error} / @authorize.isUploadAuthorized`;
  }
};

export const isDeleteAuthorized = async (model, tableName, user) => {
  try {
    const data = await model.findOne({
      where: { name: tableName },
    });

    if (!data) return true;

    if (data && await isAdmin(user)) return true;
    if (data && await isOwner(user, data)) return true;

    return false;
  } catch (error) {
    throw `${error} / @authorize.isDeleteAuthorized`;
  }
};

export const isIpAuthorized = async (request, range) => {
  try {
    const ip = requestIp.getClientIp(request);
    const geometry = geoip.lookup(ip);

    if (!geometry)
      return false;
    if (range === 'NTU')
      return ip.startsWith('140.112');

    return geometry.country === 'TW';
  } catch (error) {
    throw `${error} / @authorize.isIpAuthorized`;
  }
};
