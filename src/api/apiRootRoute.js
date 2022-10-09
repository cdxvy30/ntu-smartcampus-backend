import * as oauth2Controller from './User/Oauth2Controller';

const express = require('express');

const router = express.Router();

router.use('/user', require('./User/UserRoute'));

router.use(oauth2Controller.tokenVerify);

router.use('/shp', require('./ShpData/ShpDataRoute'));

router.use('/point', require('./PointData/PointDataRoute'));

router.use('/sensor', require('./SensorData/SensorDataRoute'));

router.use('/publish', require('./Publish/PublishRoute'));

router.use('/backup', require('./Backup/BackupRoute'));

router.use('/admin', require('./Admin/AdminRoute'));

router.use('*', (req, res) => {
  res.status(404).send('api not found');
});

export default router;
