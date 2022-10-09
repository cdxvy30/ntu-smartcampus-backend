import { Router } from 'express';
import * as controller from './AdminController';

const router = Router();

router.route('/data/list')
  .get(controller.getAllData);

router.route('/user/list')
  .get(controller.getAllUsers);

router.route('/pending-data/list')
  .get(controller.getPendingData);

router.route('/pending-user/list')
  .get(controller.getPendingUsers);

router.route('/pending-publish/list')
  .get(controller.getPendingPublish);

router.route('/data/validate')
  .put(controller.validateData);

router.route('/user/validate')
  .put(controller.validateUser);

router.route('/publish/validate')
  .put(controller.validatePublish);

router.route('/data/cancel')
  .put(controller.cancelDataApplication);

router.route('/user/cancel')
  .put(controller.cancelUserApplication);

router.route('/publish/cancel')
  .put(controller.cancelPublishApplication);

module.exports = router;
