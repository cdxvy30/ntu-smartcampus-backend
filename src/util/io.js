import { PointDataModel } from '../api/PointData/PointDataModel';
import { ShapeDataModel } from '../api/ShpData/ShpDataModel';
import { getDataFromFile } from './general';
import {
  createTable, bulkInsert, getTable, getTableColumns,
} from './database';

const xlsx = require('xlsx');
const excel = require('exceljs');
const transformation = require('transform-coordinates');

const createSchema = (dataStruct) => {
  try {
    const schema = JSON.parse(dataStruct).map((d) => ({
      name: `"${d.name}"`,
      type: d.type === 'string' ? 'VARCHAR (255)' : 'NUMERIC',
      constraint: '',
    }));

    schema.push({
      name: '"version"',
      type: 'NUMERIC',
      constraint: 'NOT NULL',
    });

    return schema;
  } catch (err) {
    throw `${err} / @io.createSchema`;
  }
};

const readExcel = async (uploadPath, dataStruct, version) => {
  try {
    const workbook = xlsx.readFile(uploadPath);
    const sheetNames = workbook.SheetNames;
    const sheet1 = workbook.Sheets[sheetNames[0]];
    const range = xlsx.utils.decode_range(sheet1['!ref']);
    const header = [];
    const skipColumn = [];
    const bulkData = [];
    let content = [];

    for (let R = range.s.r; R <= range.e.r; R += 1) {
      for (let C = range.s.c; C <= range.e.c; C += 1) {
        const cellAddress = { c: C, r: R };
        const cell = xlsx.utils.encode_cell(cellAddress);

        if (R === range.s.r) {
          if (sheet1[cell]
            && JSON.parse(dataStruct).find((d) => d.name === sheet1[cell].v) !== undefined)
            header.push(sheet1[cell].v);
          else skipColumn.push(C);
        } else {
          if (skipColumn.includes(C)) continue;

          const dataType = JSON.parse(dataStruct).find(
            (d) => d.name === header[content.length],
          ).type;

          switch (dataType) {
            case 'int':
              if (!sheet1[cell])
                content.push(0);
              else if (typeof sheet1[cell].v !== 'number')
                content.push(0);
              else
                content.push(sheet1[cell].v);
              break;
            case 'double':
              if (!sheet1[cell])
                content.push(0.0);
              else if (typeof sheet1[cell].v !== 'number')
                content.push(0.0);
              else
                content.push(sheet1[cell].v);
              break;
            case 'string':
              if (!sheet1[cell])
                content.push('');
              else
                content.push(sheet1[cell].v.replaceAll('\r\n', ' '));
              break;
            default:
              break;
          }
        }
      }

      const rowContent = JSON.parse(JSON.stringify(content));
      const dataObject = {};
      header.map((h, index) => { dataObject[h] = rowContent[index]; });
      dataObject.version = version;

      if (R !== range.s.r)
        bulkData.push(dataObject);

      content = [];
    }

    return bulkData;
  } catch (err) {
    throw `${err} / @io.readExcel`;
  }
};

const readJson = async (uploadPath, dataStruct, version) => {
  try {
    let bulkData = await getDataFromFile(uploadPath);
    bulkData = JSON.parse(bulkData).map((d) => {
      const arrangedData = {};
      JSON.parse(dataStruct).map((struct) => {
        switch (struct.type) {
          case 'int':
            if (!(struct.name in d))
              arrangedData[struct.name] = 0;
            else if (typeof d[struct.name] !== 'number')
              arrangedData[struct.name] = 0;
            else
              arrangedData[struct.name] = d[struct.name];
            break;
          case 'double':
            if (!(struct.name in d))
              arrangedData[struct.name] = 0.0;
            else if (typeof d[struct.name] !== 'number')
              arrangedData[struct.name] = 0.0;
            else
              arrangedData[struct.name] = d[struct.name];
            break;
          case 'string':
            if (!(struct.name in d))
              arrangedData[struct.name] = '';
            else
              arrangedData[struct.name] = d[struct.name];
            break;
          default:
            break;
        }
      });
      arrangedData.version = version;
      return arrangedData;
    });

    return bulkData;
  } catch (err) {
    throw `${err} / @io.readJson`;
  }
};

const transformCoordinate = (transformParams) => {
  try {
    const {
      pointData, xPropertyName, yPropertyName, coordinateSystem,
    } = transformParams;

    const arrangedData = pointData.map((pointObject) => {
      const newPointObject = pointObject;
      const transform = transformation(coordinateSystem, '4326');
      const x = newPointObject[xPropertyName];
      const y = newPointObject[yPropertyName];
      newPointObject[xPropertyName] = transform.forward({ x, y }).x;
      newPointObject[yPropertyName] = transform.forward({ x, y }).y;
      return newPointObject;
    });

    return arrangedData;
  } catch (err) {
    throw `${err} / @io.transformCoordinate`;
  }
};

const getCurrentVersion = async (dataModel, tableName) => {
  const model = await dataModel.findOne({
    where: { name: tableName },
  });
  const version = model ? (parseFloat(model.version) + 1.0).toFixed(1) : '1.0';
  return version;
};

export const isDataSchemaMatched = async (fileName, schema) => {
  try {
    const tableColumnObjects = await getTableColumns(fileName);
    const tableColumnNames = tableColumnObjects
      .map((obj) => obj.column_name);
    const dataColumnNames = schema.map((data) => data.name.replaceAll('"', ''));
    return tableColumnNames.sort().join(',') === dataColumnNames.sort().join(',');
  } catch (err) {
    throw `${err} / @io.isDataSchemaMatched`;
  }
};

export const readExcelPoint = async (fileParams) => {
  try {
    const {
      fileName,
      filePath,
      dataStruct,
      xPropertyName,
      yPropertyName,
      keyPropertyName,
      coordinateSystem,
    } = fileParams;

    const schema = createSchema(dataStruct);
    const tableName = fileName.substr(0, fileName.lastIndexOf('.'));
    const version = await getCurrentVersion(PointDataModel, tableName);
    if (version === '1.0') await createTable(tableName, schema);

    if (version !== '1.0' && !await isDataSchemaMatched(tableName, schema))
      return { complete: false, message: '檔案欄位與前版本不同，請調整成一致欄位，或是更換檔案名稱後上傳' };

    let pointData = await readExcel(filePath, dataStruct, version);
    pointData = transformCoordinate({
      pointData,
      xPropertyName,
      yPropertyName,
      coordinateSystem: coordinateSystem === 'default' ? '4326' : coordinateSystem,
    });

    pointData = pointData.filter((data) => data[keyPropertyName].length > 0);
    if (pointData.length === 0)
      return { complete: false, message: '檔案內無可用資料，請確保資料Key Property欄位皆已填入數值' };

    bulkInsert(tableName, schema, pointData);
    return { complete: true };
  } catch (err) {
    throw `${err} / @io.readExcelPoint`;
  }
};

export const readExcelShp = async (fileParams) => {
  try {
    const {
      fileName, filePath, dataStruct, keyPropertyName,
    } = fileParams;

    const schema = createSchema(dataStruct);
    const tableName = fileName.substr(0, fileName.lastIndexOf('.'));
    const version = await getCurrentVersion(ShapeDataModel, tableName);
    if (version === '1.0') await createTable(tableName, schema);

    if (version !== '1.0' && !await isDataSchemaMatched(tableName, schema))
      return { complete: false, message: '檔案欄位與前版本不同，請調整成一致欄位，或是更換檔案名稱後上傳' };

    let shpData = await readExcel(filePath, dataStruct, version);

    shpData = shpData.filter((data) => data[keyPropertyName].length > 0);
    if (shpData.length === 0)
      return { complete: false, message: '檔案內無可用資料，請確保資料Key Property欄位皆已填入數值' };

    bulkInsert(tableName, schema, shpData);
    return { complete: true };
  } catch (err) {
    throw `${err} / @io.readExcelShp`;
  }
};

export const readJsonPoint = async (fileParams) => {
  try {
    const {
      fileName,
      filePath,
      dataStruct,
      xPropertyName,
      yPropertyName,
      keyPropertyName,
      coordinateSystem,
    } = fileParams;

    const schema = createSchema(dataStruct);
    const tableName = fileName.substr(0, fileName.lastIndexOf('.'));
    const version = await getCurrentVersion(PointDataModel, tableName);
    if (version === '1.0') await createTable(tableName, schema);

    if (version !== '1.0' && !await isDataSchemaMatched(tableName, schema))
      return { complete: false, message: '檔案欄位與前版本不同，請調整成一致欄位，或是更換檔案名稱後上傳' };

    let pointData = await readJson(filePath, dataStruct, version);
    pointData = transformCoordinate({
      pointData,
      xPropertyName,
      yPropertyName,
      coordinateSystem: coordinateSystem === 'default' ? '4326' : coordinateSystem,
    });

    pointData = pointData.filter((data) => data[keyPropertyName].length > 0);
    if (pointData.length === 0)
      return { complete: false, message: '檔案內無可用資料，請確保資料Key Property欄位皆已填入數值' };

    bulkInsert(tableName, schema, pointData);
    return { complete: true };
  } catch (err) {
    throw `${err} / @io.readJsonPoint`;
  }
};

export const readJsonShp = async (fileParams) => {
  try {
    const {
      fileName, filePath, dataStruct, keyPropertyName,
    } = fileParams;

    const schema = createSchema(dataStruct);
    const tableName = fileName.substr(0, fileName.lastIndexOf('.'));
    const version = await getCurrentVersion(ShapeDataModel, tableName);
    if (version === '1.0') await createTable(tableName, schema);

    if (version !== '1.0' && !await isDataSchemaMatched(tableName, schema))
      return { complete: false, message: '檔案欄位與前版本不同，請調整成一致欄位，或是更換檔案名稱後上傳' };

    let shpData = await readJson(filePath, dataStruct, version);

    shpData = shpData.filter((data) => data[keyPropertyName].length > 0);
    if (shpData.length === 0)
      return { complete: false, message: '檔案內無可用資料，請確保資料Key Property欄位皆已填入數值' };

    bulkInsert(tableName, schema, shpData);
    return { complete: true };
  } catch (err) {
    throw `${err} / @io.readJsonShp`;
  }
};

export const writeExcel = async (fileName, version) => {
  try {
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet(fileName);
    const header = [];

    const result = await getTable(fileName, version);

    Object.keys(result[0]).map((key) => {
      header.push({
        header: key,
        key,
        width: 20,
      });
    });

    worksheet.columns = header;
    worksheet.addRows(result);

    return workbook;
  } catch (err) {
    throw `${err} / @io.writeExcel`;
  }
};
