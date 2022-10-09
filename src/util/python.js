import { config } from '../config';
import { PublishModel } from '../api/Publish/PublishModel';

const { spawn } = require('child_process');
const path = require('path');
const rimraf = require('rimraf');

// eslint-disable-next-line import/prefer-default-export
// export const createPointLayer = async (
//   pythonFilePath, dataTableName, xPropertyName, yPropertyName, dataStruct,
// ) => {
//   const process = spawn(
//     config.development.pythonPath,
//     [
//       pythonFilePath,
//       dataTableName,
//       xPropertyName,
//       yPropertyName,
//       dataStruct,
//     ],
//   );

//   let data = '';
//   for await (const chunk of process.stdout) {
//     data += chunk;
//   }

//   let error = '';
//   for await (const chunk of process.stderr) {
//     error += chunk;
//   }

//   const exitCode = await new Promise((resolve) => {
//     process.on('close', resolve);
//   });

//   if (exitCode) {
//     throw new Error(`subprocess error exit ${exitCode}, ${error}`);
//   }

//   console.log(data);
//   rimraf(path.join(config.development.arcgisProjectPath, 'tmp'), () => { });
// };

export const publishFeautreService = async (params) => {
  const {
    pythonFilePath, id, arcgisUser, arcgisPassword, arcgisPortal, serviceName, fileNames,
  } = params;

  const process = spawn(
    config.development.pythonPath,
    [
      pythonFilePath,
      id,
      arcgisUser,
      arcgisPassword,
      arcgisPortal,
      serviceName,
      fileNames,
    ],
  );

  let error = '';
  for await (const chunk of process.stderr) {
    error += chunk;
  }

  const exitCode = await new Promise((resolve) => {
    process.on('close', resolve);
  });

  if (exitCode) {
    const errorType = error.substring(error.lastIndexOf('Exception: ') + 11);
    const errorMessage = errorMessageMapping[errorType.trim()];
    await PublishModel.update(
      { status: 'Fail', message: errorMessage },
      { where: { id } },
    );
    return;
  }

  await PublishModel.update(
    { status: 'Success', message: '發佈成功' },
    { where: { id } },
  );

  rimraf(path.join(__dirname, `../../projects/${id}`), () => { });
  rimraf(path.join(__dirname, `../../projects/${id}_files`), () => { });
};

const errorMessageMapping = {
  'Authentication Error': '無法登入Arcgis, 請檢查username, password, portal是否錯誤',
  'System Error': '資料無法處理',
  'Format Error': '無法解析Shapefile，請確認上傳之zip檔格式正確',
  'Connection Error': '無法於Arcgis發佈服務，請確認Arcgis Server連線正常',
};

// // 產生layer
// let tblName = fileName.split('.')[0];
// if (tblName.substr(-1) == 's') tblName += 'es';
// else tblName += 's';

// createPointLayer(
//   path.join(__dirname, `../../scripts/create_point_layer.py`),
//   tblName,
//   xPropertyName,
//   yPropertyName,
//   dataStruct
// )
