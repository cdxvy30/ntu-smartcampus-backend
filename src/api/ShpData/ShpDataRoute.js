import { Router } from 'express';
import * as controller from './ShpDataController';

const router = Router();

router.route('/file/create')
  .post(controller.postShpFile);

router.route('/data/create')
  .post(controller.postShpData);

router.route('/common/create')
  .post(controller.postCommonFile);

router.route('/file/list')
  .get(controller.getShpFileList);

router.route('/data/list')
  .get(controller.getShpDataList);

router.route('/common/list')
  .get(controller.getCommonFileList);

router.route('/file/download/:fileName/:version?')
  .get(controller.downloadShpFile);

router.route('/data/download/:fileName/:version?')
  .get(controller.downloadShpData);

router.route('/common/download/:fileName/:version?')
  .get(controller.downloadCommonFile);

router.route('/file/read/:fileName/:version?')
  .get(controller.getShpFile);

router.route('/data/read/:fileName/:version?')
  .get(controller.getShpData);

router.route('/layer')
  .get(controller.getJoinedLayer);

router.route('/file/key/:fileName/:version?')
  .get(controller.getKeyPropList);

router.route('/file/remove/:fileName/:version?')
  .delete(controller.removeShpFile);

router.route('/data/remove/:fileName/:version?')
  .delete(controller.removeShpData);

router.route('/common/remove/:fileName/:version?')
  .delete(controller.removeCommonFile);

module.exports = router;
