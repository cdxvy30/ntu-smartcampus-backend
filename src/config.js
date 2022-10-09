require('dotenv').config();

// eslint-disable-next-line import/prefer-default-export
export const config = {
  development: {
    db_url: process.env.DB_URL,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    pythonPath: process.env.PYTHON_PATH,
    arcgisProjectPath: process.env.ARCGIS_PROJECT_PATH,
    restore: process.env.RESTORE_ON_STARTUP,
    version: process.env.RESTORE_VERSION,
    adminUsername: process.env.ADMIN_USER,
    adminPassword: process.env.ADMIN_PASSWORD,
    adminEmail: process.env.ADMIN_EMAIL,
    bimuAccountName: process.env.BIMU_ACCOUNT_NAME,
    bimuApiKey: process.env.BIMU_API_KEY,
    bimuChannelId: process.env.BIMU_CHHANNEL_ID,
    execMode: process.env.EXEC_MODE,
    sshUsername: process.env.SSH_USER,
    sshPassword: process.env.SSH_PASSWORD,
    sendgridAccount: process.env.SENDGRID_ACCOUNT,
    sendgridApiKey: process.env.SENDGRID_API_KEY,
  },
  auth: {
    secret: process.env.secret,
    increaseTime: process.env.increaseTime,
  },
};
