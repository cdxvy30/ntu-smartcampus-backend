import { config } from '../config';

const axios = require('axios');

const baseUrl = 'https://viewer.bimu.io/api/v1';
const selectedChannelId = '60cbfd0c1a0a6500044ccd81';
const extension = 'ifc';

const getToken = async () => {
  const accountName = config.development.bimuAccountName;
  const apiKey = config.development.bimuApiKey;
  const base64Encoded = Buffer.from(`${accountName}:${apiKey}`).toString('base64');

  const options = {
    method: 'post',
    url: 'https://viewer.bimu.io/rest/api/v1/token',
    headers: {
      Authorization: `Basic ${base64Encoded}`,
    },
  };

  const { data } = await axios(options);
  const accessToken = data.token;

  return accessToken;
};

const getS3Url = async (accessToken) => {
  const options = {
    method: 'get',
    url: `${baseUrl}/channels/${selectedChannelId}/attachments/upload?ext=${extension}`,
    headers: {
      Authorization: `Basic ${accessToken}`,
    },
  };

  const { data } = await axios(options);
  const s3Url = data.url;
  return s3Url;
};

// eslint-disable-next-line no-unused-vars
const uploadModel = async (accessToken, url) => {
  const options = {
    method: 'put',
    url,
    headers: {
      Authorization: `Basic ${accessToken}`,
      'Content-Type': 'binary/octet-stream',
    },
  };

  const response = await axios(options);
  const s3Url = response.url;
  return s3Url;
};

getToken().then((accessToken) => {
  getS3Url(accessToken).then((url) => {
    console.log(url);
  });
});

// const s3Url = await getS3Url(accessToken);
// await uploadModel(accessToken, s3Url);
