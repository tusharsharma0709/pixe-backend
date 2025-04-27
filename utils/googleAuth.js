const { google } = require('googleapis');

const privateKey = process.env.GTM_PRIVATE_KEY.replace(/\\n/g, '\n');

const getAuth = async () => {
  const authClient = new google.auth.JWT(
    process.env.GTM_CLIENT_EMAIL,
    null,
    privateKey,
    [
      'https://www.googleapis.com/auth/tagmanager.edit.containers',
      'https://www.googleapis.com/auth/tagmanager.publish',
      'https://www.googleapis.com/auth/tagmanager.manage.accounts',
    ]
  );

  await authClient.authorize();
  return authClient;
};

module.exports = { getAuth };
