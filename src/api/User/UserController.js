import { UserModel } from "./UserModel";
import { isAdmin } from "../../util/authorize";

const bcrypt = require("bcrypt");
const uniqid = require("uniqid");

export const register = async (req, res) => {
  try {
    const {
      username,
      password,
      displayName,
      role,
      department,
      email,
      staffCardImage,
    } = req.body;

    const [user, created] = await UserModel.findOrCreate({
      where: { username },
      defaults: {
        _id: uniqid(),
        username,
        email,
        password: bcrypt.hashSync(password || username, 10),
        displayName,
        department,
        role,
        staffCardImage,
        validated: false,
      },
    });

    if (!created) return res.status(400).send("帳戶已存在");

    return res.status(200).send(user);
  } catch (e) {
    return res.status(500).send("無法新增帳戶");
  }
};

export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await UserModel.findOne({
      where: { username },
    });

    if (!user) return res.status(400).send("請先註冊");
    if (!user.validated) return res.status(400).send("尚未驗證");

    const dbHashPassword = user.password;
    const userPassword = password;
    const isMatched = await bcrypt.compare(userPassword, dbHashPassword);

    if (!isMatched) return res.status(400).send("密碼錯誤");

    req.results = [
      {
        _id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        department: user.department,
        role: user.role,
      },
    ];
    return next();
  } catch (e) {
    return res.status(500).send("登入失敗");
  }
};

export const edit = async (req, res) => {
  try {
    let user = await UserModel.findOne({
      where: { _id: req.user._id },
    });

    if (!user) return res.status(400).send("帳戶不存在");

    user = await UserModel.update(
      { ...req.body.values },
      { where: { _id: req.user._id } }
    );

    return res.status(200).send({
      _id: user._id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      department: user.department,
      role: user.role,
    });
  } catch (e) {
    return res.status(500).send("編輯失敗");
  }
};

export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await UserModel.findOne({
      where: { _id: req.user._id },
    });

    if (!user) return res.status(400).send("帳戶不存在");

    const dbHashPassword = user.password;
    const isMatched = await bcrypt.compare(oldPassword, dbHashPassword);

    if (!isMatched) return res.status(400).send("舊密碼錯誤");

    await UserModel.update(
      { password: bcrypt.hashSync(newPassword, 10) },
      { where: { _id: req.user._id } }
    );

    return res.status(200).send("更改成功");
  } catch (e) {
    return res.status(500).send("更改密碼失敗");
  }
};

export const get = async (req, res, next) => {
  try {
    const user = await UserModel.findOne({
      where: { _id: req.user._id },
    });

    if (!user) return res.status(400).send("帳戶不存在");

    req.results = [
      {
        _id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        department: user.department,
        role: user.role,
      },
    ];
    return next();
  } catch (e) {
    return res.status(500).send("取得帳戶失敗");
  }
};

export const simpleGet = async (req, res) => {
  try {
    const user = await UserModel.findOne({
      where: { _id: req.query._id },
    });

    if (!user) return res.status(400).send("帳戶不存在");

    return res.status(200).send({
      _id: user._id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      department: user.department,
      role: user.role,
      validated: user.validated,
    });
  } catch (e) {
    return res.status(500).send("失敗");
  }
};

export const getAll = async (req, res) => {
  try {
    if (!(await isAdmin(req.user)))
      return res.status(400).send("無管理者權限，失敗");

    const users = await UserModel.findAll({
      where: { role: "user" },
    });

    if (!users) return res.status(400).send("失敗");

    return res.status(200).send(users);
  } catch (e) {
    return res.status(500).send("失敗");
  }
};

export const deleteUser = async (req, res) => {
  try {
    if (!(await isAdmin(req.user)))
      return res.status(400).send("無管理者權限，失敗");

    const { username } = req.params;

    const user = await UserModel.findOne({
      where: { username },
    });

    if (!user) return res.status(400).send("失敗");

    await UserModel.destroy({
      where: { username },
    });

    return res.status(200).send("刪除成功");
  } catch (e) {
    return res.status(500).send("失敗");
  }
};
