import { config } from '../config';
import logger from '../logger';

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const copyFrom = require('pg-copy-streams').from;
const pgtools = require('pgtools');
const { Pool } = require('pg');
const { spawn } = require('child_process');
const { NodeSSH } = require('node-ssh');
const { Readable } = require('stream');

const ssh = new NodeSSH();
const pool = new Pool(config.development.db_url
  ? config.development.db_url
  : {
    user: config.development.username,
    host: config.development.host,
    database: config.development.database,
    password: config.development.password,
    port: config.development.port,
  });

const infoLog = (message) => {
  logger.info(`[DB] ${message}`);
};

export const isDatabaseExist = async () => {
  try {
    const { username, password, database } = config.development;

    if (config.development.execMode === 'local') {
      const process = spawn(
        'sh',
        ['./scripts/sh/checkDbExist.sh',
          username,
          password,
          database,
        ],
      );

      let data = '';
      for await (const chunk of process.stdout) {
        data += chunk;
      }

      let error = '';
      for await (const chunk of process.stderr) {
        error += chunk;
      }

      const exitCode = await new Promise((resolve) => {
        process.on('close', resolve);
      });

      if (exitCode) {
        throw `subprocess error exit ${exitCode}, ${error}`;
      }

      return (data.replace(/^\s+|\s+$/g, '') === 'true');
    }

    if (config.development.execMode === 'docker') {
      try {
        await ssh.connect({
          host: config.development.host,
          username: config.development.sshUsername,
          password: config.development.sshPassword,
          port: 22,
        });

        const result = await ssh.exec(
          'sh',
          ['/app/scripts/sh/checkDbExist.sh',
            username,
            password,
            database,
          ],
        );

        if (result === 'true' || result === 'false')
          return (result.replace(/^\s+|\s+$/g, '') === 'true');
      } catch (error) {
        if (error.message.includes('does not exist'))
          return false;
        throw error;
      }
    }

    return false;
  } catch (err) {
    throw `${err} / @database.isDatabaseExist`;
  }
};

export const isTableExist = async (tableName) => {
  try {
    const client = await pool.connect();

    const queryString = `SELECT to_regclass('public."${tableName}"')`;
    const results = await client.query(queryString);

    client.release();

    return results.rows[0].to_regclass != null;
  } catch (err) {
    throw `${err} / @database.isTableExist`;
  }
};

export const isVersionExist = async (tableName, version) => {
  try {
    if (!version || version === 'latest')
      return true;

    const client = await pool.connect();

    const queryString = `SELECT * FROM "${tableName}" WHERE "version"='${version}'`;
    const results = await client.query(queryString);

    client.release();

    return results.rows.length !== 0;
  } catch (err) {
    throw `${err} / @database.isVersionExist`;
  }
};

export const isDataExist = async (tableName, key, value) => {
  try {
    const client = await pool.connect();

    const queryString = `SELECT * FROM "${tableName}" WHERE "${key}"='${value}'`;
    const results = await client.query(queryString);

    client.release();

    return results.rows.length !== 0;
  } catch (err) {
    throw `${err} / @database.isTableExist`;
  }
};

export const isTableEmpty = async (tableName) => {
  try {
    const client = await pool.connect();

    const queryString = `SELECT * from "${tableName}"`;
    const results = await client.query(queryString);

    client.release();

    return results.rows.length === 0;
  } catch (err) {
    throw `${err} / @database.isTableExist`;
  }
};

export const createDatabase = async () => {
  try {
    const {
      username, password, host, port, database,
    } = config.development;

    const params = {
      user: username, host, password, port,
    };

    await pgtools.createdb(params, database);

    infoLog(`新增資料庫! (${database})`);
    return;
  } catch (err) {
    throw `${err} / @database.createDatabase`;
  }
};

export const removeDatabase = async () => {
  try {
    const {
      username, password, host, port, database,
    } = config.development;

    const params = {
      user: username, host, password, port,
    };

    await pgtools.dropdb(params, database);

    infoLog(`移除資料庫! (${database})`);
    return;
  } catch (err) {
    throw `${err} / @database.removeDatabase`;
  }
};

export const createTable = async (tableName, schema) => {
  try {
    const client = await pool.connect();

    let queryString = `CREATE TABLE "${tableName}"(`;
    schema.map((c) => {
      queryString += `${c.name} ${c.type} ${c.constraint}, `;
    });
    queryString = `${queryString.substring(0, queryString.length - 2)})`;
    await client.query(queryString);

    infoLog(`Table created! (${tableName})`);
    client.release();
    return;
  } catch (err) {
    throw `${err} / @database.createTable`;
  }
};

// eslint-disable-next-line arrow-body-style
export const bulkInsert = (tableName, schema, dataList) => {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    infoLog(`Insert Data! (${tableName})`);
    const client = await pool.connect();

    const done = () => {
      client.release();
      resolve();
    };

    let copyString = `COPY "${tableName}" (`;
    schema.map((s) => {
      copyString += `${s.name},`;
    });
    copyString = copyString.substr(0, copyString.length - 1);
    copyString += ') FROM STDIN';

    const stream = client.query(copyFrom(copyString));
    const rs = new Readable();
    let currentIndex = 0;

    rs._read = () => {
      if (currentIndex === dataList.length) {
        rs.push(null);
        done();
      } else {
        const data = dataList[currentIndex];
        let inputString = '';
        Object.keys(data).map((key, index) => {
          if (index === Object.keys(data).length - 1)
            inputString += `${data[key]}\n`;
          else
            inputString += `${data[key]}\t`;
        });
        rs.push(inputString);
        currentIndex += 1;
      }
    };

    const onError = (strErr) => {
      // eslint-disable-next-line prefer-promise-reject-errors
      reject(`${strErr} / @database.bulkInsert`);
      done();
    };

    rs.on('error', onError);
    stream.on('error', onError);
    stream.on('end', done);
    rs.pipe(stream);
  });
};

export const getLatestVersion = async (tableName) => {
  try {
    const client = await pool.connect();

    const queryString = `SELECT MAX(version) FROM "${tableName}"`;
    const result = await client.query(queryString);

    client.release();

    return result.rows[0].max;
  } catch (err) {
    throw `${err} / @database.getLatestVersion`;
  }
};

export const getTableKey = async (tableName) => {
  try {
    const client = await pool.connect();

    const queryString = `SELECT "key-property-name" FROM "shape-data-managements" WHERE "name" = '${tableName}'`;
    const result = await client.query(queryString);

    client.release();

    return result.rows[0]['key-property-name'];
  } catch (err) {
    throw `${err} / @database.getTableKey`;
  }
};

export const getTableColumns = async (tableName) => {
  try {
    const client = await pool.connect();

    const queryString = `SELECT column_name FROM INFORMATION_SCHEMA.COLUMNS WHERE "table_name"='${tableName}'`;
    const result = await client.query(queryString);

    client.release();

    return result.rows;
  } catch (err) {
    throw `${err} / @database.getTableColumn`;
  }
};

export const getTable = async (tableName, version) => {
  try {
    const client = await pool.connect();

    let targetVersion;
    if (!version) targetVersion = await getLatestVersion(tableName);
    else targetVersion = parseFloat(version).toFixed(1);

    const queryString = `SELECT * FROM "${tableName}" WHERE "version"='${targetVersion}'`;
    const result = await client.query(queryString);

    client.release();

    return result.rows;
  } catch (err) {
    throw `${err} / @database.getTable`;
  }
};

export const getTableWithoutVersion = async (tableName) => {
  try {
    const client = await pool.connect();

    const queryString = `SELECT * FROM "${tableName}"`;
    const result = await client.query(queryString);

    client.release();

    return result.rows;
  } catch (err) {
    throw `${err} / @database.getTableWithoutVersion`;
  }
};

export const updateData = async (tableName, object) => {
  try {
    const client = await pool.connect();
    const objectName = object.name;

    let updateString = `UPDATE "${tableName}" SET `;
    Object.keys(object).map((key) => {
      if (key === 'name') return;
      updateString += `"${key}"='${object[key]}', `;
    });
    updateString = updateString.substr(0, updateString.length - 2);
    updateString += ` WHERE "name"='${objectName}'`;
    const result = await client.query(updateString);

    client.release();

    return result.rows;
  } catch (err) {
    throw `${err} / @database.updateData`;
  }
};

export const removeTable = async (tableName, version) => {
  try {
    const client = await pool.connect();

    if (version) {
      let queryString = `DELETE FROM "${tableName}" WHERE "version"='${parseFloat(version).toFixed(1)}'`;
      await client.query(queryString);

      queryString = `SELECT * FROM "${tableName}"`;
      const result = await client.query(queryString);

      if (result.rows.length === 0) {
        queryString = `DROP TABLE "${tableName}"`;
        await client.query(queryString);
      }
    } else {
      const queryString = `DROP TABLE "${tableName}"`;
      await client.query(queryString);
    }

    client.release();
    return;
  } catch (err) {
    throw `${err} / @database.removeTable`;
  }
};

export const removeData = async (tableName, key, value) => {
  try {
    const client = await pool.connect();
    const queryString = `DELETE FROM "${tableName}" WHERE "${key}"='${value}'`;
    await client.query(queryString);

    client.release();
    return;
  } catch (err) {
    throw `${err} / @database.removeData`;
  }
};

export const getJoinedTable = async (nameList, versionList) => {
  try {
    const client = await pool.connect();

    const keyList = [];
    for (let i = 0; i < nameList.length; i += 1) {
      const keyName = await getTableKey(nameList[i]);
      keyList.push(keyName);
    }

    let queryString = `SELECT * FROM "${nameList[0]}" `;
    for (let i = 1; i < nameList.length; i += 1) {
      const version = versionList[i]
        ? parseFloat(versionList[i]).toFixed(1)
        : await getLatestVersion(nameList[i]);

      queryString += `LEFT OUTER JOIN "${nameList[i]}" ON "${nameList[0]}"."${keyList[0]}" = "${nameList[i]}"."${keyList[i]}" AND "${nameList[i]}"."version" = '${version}' `;
    }
    queryString += `WHERE "${nameList[0]}"."version" = '${versionList[0] ? parseFloat(versionList[0]).toFixed(1) : await getLatestVersion(nameList[0])}'`;
    queryString += ';';

    const result = await client.query(queryString);

    client.release();

    keyList.shift();
    return removeJoinKey(result.rows, keyList);
  } catch (err) {
    throw `${err} / @database.getJoinedTable`;
  }

  // SELECT * from "ElectricityFinal" LEFT OUTER JOIN "統整" ON "ElectricityFinal"."UID" = "統整"."UID"
  // AND "統整"."version" = '3.0' WHERE "ElectricityFinal"."version" = '2.0';
};

export const removeJoinKey = async (data, joinKeyList) => {
  try {
    return data.map((d) => _.omit(d, joinKeyList));
  } catch (err) {
    throw `${err} / @database.removeJoinKey`;
  }
};

export const backupDatabase = async () => {
  try {
    const { username, database, password } = config.development;
    const filePath = path.join(__dirname, '../../backups/tmp/database/db_dump.pgsql');

    if (!fs.existsSync(path.join(__dirname, '../../backups/tmp/database')))
      fs.mkdirSync(path.join(__dirname, '../../backups/tmp/database'), {
        recursive: true,
      });

    if (config.development.execMode === 'local') {
      const process = spawn(
        'sh',
        ['./scripts/sh/backupDb.sh',
          username,
          database,
          password,
          filePath,
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
        throw `subprocess error exit ${exitCode}, ${error}`;
      }
      return infoLog(`備份資料庫! (${database})`);
    }

    if (config.development.execMode === 'docker') {
      await ssh.connect({
        host: config.development.host,
        username: config.development.sshUsername,
        password: config.development.sshPassword,
        port: 22,
      });

      const result = await ssh.exec(
        'sh',
        ['/app/scripts/sh/backupDb.sh',
          username,
          database,
          password,
          filePath,
        ],
      );

      if (result) throw result;
      return infoLog(`備份資料庫! (${database})`);
    }

    return false;
  } catch (err) {
    throw `${err} / @database.backupDatabase`;
  }
};

export const restoreDatabase = async () => {
  try {
    const { username, database, password } = config.development;
    const filePath = path.join(__dirname, '../../backups/tmp/database/db_dump.pgsql');

    if (await isDatabaseExist()) await removeDatabase();
    await createDatabase();

    if (config.development.execMode === 'local') {
      const process = spawn(
        'sh',
        ['./scripts/sh/restoreDb.sh',
          username,
          database,
          password,
          filePath,
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
        throw `subprocess error exit ${exitCode}, ${error}`;
      }

      return infoLog(`還原資料庫! (${database})`);
    }

    if (config.development.execMode === 'docker') {
      await ssh.connect({
        host: config.development.host,
        username: config.development.sshUsername,
        password: config.development.sshPassword,
        port: 22,
      });

      const result = await ssh.exec(
        'sh',
        ['/app/scripts/sh/restoreDb.sh',
          username,
          database,
          password,
          filePath,
        ],
      );

      if (result.startsWith('psql:')) throw result;

      return infoLog(`還原資料庫! (${database})`);
    }

    return false;
  } catch (err) {
    throw `${err} / @database.restoreDatabase`;
  }
};
