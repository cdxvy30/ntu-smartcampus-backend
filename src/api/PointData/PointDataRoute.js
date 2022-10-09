import { Router } from 'express';
import * as controller from './PointDataController';

const router = Router();

router.route('/data/create')
  .post(controller.postPointData);

router.route('/data/list')
  .get(controller.getPointDataList);

router.route('/data/download/:fileName/:version?')
  .get(controller.downloadPointData);

router.route('/data/read/:fileName/:version?')
  .get(controller.getPointData);

router.route('/data/key/:fileName/:version?')
  .get(controller.getKeyPropList);

router.route('/data/remove/:fileName/:version?')
  .delete(controller.removePointData);

module.exports = router;
