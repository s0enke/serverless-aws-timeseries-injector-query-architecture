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
  child_process.execSync("cdk deploy --outputs-file ./cdk-outputs.json --require-approval never --hotswap");
  outputs = JSON.parse(fs.readFileSync('./cdk-outputs.json', 'utf-8'))
  child_process.execSync(`cdk deploy --require-approval never --outputs-file ${__dirname}/cdk-fixtures-outputs.json --hotswap --parameters UserPoolId=${outputs.TimeseriesInjectorStack.UserPoolId}`, {cwd: __dirname});
  const fixturesOutputs = JSON.parse(fs.readFileSync(`${__dirname}/cdk-fixtures-outputs.json`, 'utf-8'))

  const cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();
  loginData = await cognitoidentityserviceprovider.adminInitiateAuth({
    AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
    ClientId: outputs.TimeseriesInjectorStack.UserPoolClientId,
    UserPoolId: outputs.TimeseriesInjectorStack.UserPoolId,
    AuthParameters: {
      USERNAME: fixturesOutputs.IntegrationTestsFixtures.UserPoolUsername,
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

  const res = await retryAsync(async () => {
    console.log("try")
    // should land in timeseries db
    const ts = new AWS.TimestreamQuery();
    const res = await ts.query({QueryString: `SELECT * from "${outputs.TimeseriesInjectorStack.TimeSeriesDatabase}"."${outputs.TimeseriesInjectorStack.TimeSeriesTable}" WHERE sensor_id='${sensor_id}'`}).promise();
    const actual = res.Rows;
    console.log(actual[0].Data);
    return res;
  });

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