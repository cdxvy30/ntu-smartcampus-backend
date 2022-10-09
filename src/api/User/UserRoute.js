import { Router } from 'express';
import * as controller from './UserController';
import * as oauth2Controller from './Oauth2Controller';

const router = Router();

router.route('/register').post(controller.register);

router.route('/login').post(controller.login).all(oauth2Controller.sendToken);

router.route('/simple-get').get(controller.simpleGet);

router.use(oauth2Controller.tokenVerify);

router.route('/edit').put(controller.edit);

router.route('/changePassword').put(controller.changePassword);

router.route('/get').get(controller.get).all(oauth2Controller.sendToken);

router.route('/get-all').get(controller.getAll);

router.route('/delete/:username').delete(controller.deleteUser);

module.exports = router;
