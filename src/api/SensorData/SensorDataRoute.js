import { Router } from 'express';
import * as controller from './SensorDataController';

const router = Router();

router.route('/project/create')
  .post(controller.postSensorProject);

router.route('/instance/create')
  .post(controller.postSensorInstance);

router.route('/project/update')
  .put(controller.updateSensorProject);

router.route('/instance/update')
  .put(controller.updateSensorInstance);

router.route('/project/list')
  .get(controller.getSensorProjectList);

router.route('/project/read/:sensorProjectName')
  .get(controller.getSensorInstances);

router.route('/instance/read/:sensorProjectName/:sensorName')
  .get(controller.getSensorInstance);

router.route('/project/remove/:sensorProjectName')
  .delete(controller.removeSensorProject);

router.route('/instance/remove/:sensorProjectName/:sensorName')
  .delete(controller.removeSensorInstance);

module.exports = router;
