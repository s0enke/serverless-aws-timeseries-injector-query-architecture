import * as child_process from "child_process";
import * as fs from 'fs'
import * as AWS from 'aws-sdk';
const axios = require('axios');
const crypto = require('crypto');
import {retryAsync} from "ts-retry";

jest.setTimeout(500000);
let outputs: any;
let loginData: any;

beforeAll(async () => {
  child_process.execSync("npx cdk deploy --outputs-file ./cdk-outputs.json --require-approval never --hotswap");
  outputs = JSON.parse(fs.readFileSync('./cdk-outputs.json', 'utf-8'))

  const cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();

  const username = crypto.randomBytes(20).toString('hex');
  const user = await cognitoidentityserviceprovider.adminCreateUser(
    {
      UserPoolId: outputs.TimeseriesInjectorStack.UserPoolId,
      Username: username,
    }
  ).promise();

  await cognitoidentityserviceprovider.adminSetUserPassword(
    {
      UserPoolId: outputs.TimeseriesInjectorStack.UserPoolId,
      Password: "I$oldeMaWidderB4d3n",
      Username: username,
      Permanent: true,
    }
  ).promise();

  loginData = await cognitoidentityserviceprovider.adminInitiateAuth({
    AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
    ClientId: outputs.TimeseriesInjectorStack.UserPoolClientId,
    UserPoolId: outputs.TimeseriesInjectorStack.UserPoolId,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: "I$oldeMaWidderB4d3n",
    }
  }).promise();
});

test('Upload to Raw Data Bucket puts data into time series DB', async () => {
  const sensor_id = crypto.randomUUID();
  const response = await axios.get(`${outputs.TimeseriesInjectorStack.UploaderApiGatewayUrl}/gen-upload-url?sensor_id=${sensor_id}`, {
    headers: {
      'Authorization': `Bearer ${loginData.AuthenticationResult.AccessToken}`
    }
  })
  let fixtureFileName = `${__dirname}/fixtures/fixture1.csv`;
  await axios.put(response.data.upload_url, fs.createReadStream(fixtureFileName), {
    headers: {
      'Content-length': fs.statSync(fixtureFileName).size,
    }
  });

  const actual = await retryAsync(async () => {
    const ts = new AWS.TimestreamQuery();
    const res = await ts.query({QueryString: `SELECT * from "${outputs.TimeseriesInjectorStack.TimeSeriesDatabase}"."${outputs.TimeseriesInjectorStack.TimeSeriesTable}" WHERE sensor_id='${sensor_id}'`}).promise();
    if (res.Rows.length != 3) {
      throw new Error("No data yet")
    }
    return res.Rows;
  }, {

    delay: 5000,
    maxTry: 10,
  });

  expect(actual).toEqual(
    [
      {
        Data: [
          {ScalarValue: sensor_id},
          {ScalarValue: 'measure'},
          {ScalarValue: '2022-02-27 23:00:00.000000000'},
          {ScalarValue: '46.4'}
        ],
      },
      {
        Data: [
          { ScalarValue: sensor_id },
          { ScalarValue: 'measure' },
          { ScalarValue: '2022-02-27 23:15:00.000000000' },
          { ScalarValue: '-8.7' }
        ],
      },
      {
        Data: [
          { ScalarValue: sensor_id },
          { ScalarValue: 'measure' },
          { ScalarValue: '2022-02-27 23:30:00.000000000' },
          { ScalarValue: '2.0' }
        ],
      },
    ],
  )

});

test.skip('Upload should generate unique filenames', () => {
});

test.skip('Upload with sensor_id belonging to another user', () => {
});

test.skip('SensorID must not contain slashes', () => {
});

test.skip('Upload without auth', () => {
});

test.skip('Upload without sensor_id', () => {
  expect(async() => {
    const response = await axios.get(`${outputs.TimeseriesInjectorStack.UploaderApiGatewayUrl}/gen-upload-url`, {
      headers: {
        'Authorization': `Bearer ${loginData.AuthenticationResult.AccessToken}`
      }
    })
    console.log(response)
  }).toThrow("adfdafasf");

});