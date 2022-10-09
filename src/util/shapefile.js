import { createTable, bulkInsert } from './database';
import { isDataSchemaMatched } from './io';
import { ShapeFileModel } from '../api/ShpData/ShpDataModel';

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');
const shapefile = require('shapefile');

export const readShpFile = async (fileName) => {
  try {
    const output = {
      type: 'FeatureCollection',
      features: [],
    };
    let result = { done: false };

    const source = await shapefile.open(
      path.join(__dirname, `../../data/shp-file/${fileName}/${fileName}.shp`),
      path.join(__dirname, `../../data/shp-file/${fileName}/${fileName}.dbf`),
      { encoding: 'utf8' },
    );
    while (!result.done) {
      result = await source.read();
      if (!result.done)
        output.features.push(result.value);
    }
    return output;
  } catch (error) {
    throw `${error} / @shapefile.readShpFile`;
  }
};

export const createFeatureLayer = async (filePath, fileName) => {
  try {
    const portalUrl = 'https://www.arcgis.com';

    const params = {
      name: fileName,
      targetSR: { wkid: 4326 },
      maxRecordCount: 100000,
      enforceInputFileSizeLimit: false,
      enforceOutputJsonSizeLimit: false,
      generalize: false,
      maxAllowableOffset: 10,
      reducePrecision: true,
      numberOfDigitsAfterDecimal: 10,
    };

    const formdata = new FormData();
    formdata.append('filetype', 'shapefile');
    formdata.append('publishParameters', JSON.stringify(params));
    formdata.append('f', 'json');
    formdata.append('file', fs.createReadStream(filePath));

    const result = await fetch(
      `${portalUrl}/sharing/rest/content/features/generate`,
      { method: 'post', body: formdata },
    );
    const featureLayer = await result.json();

    if (!featureLayer) {
      if (featureLayer.error) {
        return {};
      }
    }

    const status = await createFeatureTable(fileName, featureLayer);
    return {
      ...status,
      featureLayer,
    };
  } catch (error) {
    throw `${error} / @shapefile.createFeatureLayer`;
  }
};

export const createFeatureTable = async (fileName, featureLayer) => {
  try {
    const layer = featureLayer.featureCollection.layers[0];
    const schema = createSchema(layer.layerDefinition.fields);
    let version;

    const shapeFileRecord = await ShapeFileModel.findOne({
      where: { name: fileName },
    });

    if (!shapeFileRecord) {
      await createTable(fileName, schema);
      version = '1.0';
    } else {
      version = (parseFloat(shapeFileRecord.version) + 1.0).toFixed(1);
    }

    if (version !== '1.0' && !await isDataSchemaMatched(fileName, schema))
      return { complete: false, message: '檔案欄位與前版本不同，請調整成一致欄位，或是更換檔案名稱後上傳' };

    const bulkData = [];
    layer.featureSet.features.map((feature) => {
      bulkData.push({
        ...feature.attributes,
        version,
      });
    });

    await bulkInsert(fileName, schema, bulkData);
    return { complete: true };
  } catch (error) {
    throw `${error} / @shapefile.createFeatureTable`;
  }
};

const createSchema = (fields) => {
  const schema = [];

  fields.map((field) => {
    const type = (
      field.type === 'esriFieldTypeOID'
      || field.type === 'esriFieldTypeInteger'
      || field.type === 'esriFieldTypeDouble'
    ) ? 'NUMERIC' : 'VARCHAR (255)';

    schema.push({
      name: `"${field.name}"`,
      type,
      constraint: '',
    });
  });

  schema.push({
    name: '"version"',
    type: 'NUMERIC',
    constraint: 'NOT NULL',
  });

  return schema;
};
