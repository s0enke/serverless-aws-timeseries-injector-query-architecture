import {Duration, CfnOutput, Stack, StackProps} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as timestream from 'aws-cdk-lib/aws-timestream';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3_notifications from 'aws-cdk-lib/aws-s3-notifications';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {NodejsFunction} from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apiGateway from '@aws-cdk/aws-apigatewayv2-alpha';
import * as apiGatewayAuthorizers from '@aws-cdk/aws-apigatewayv2-authorizers-alpha';
import * as apiGatewayIntegrations from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import * as path from "path";

export class TimeseriesInjectorStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const pool = new cognito.UserPool(this, 'Pool');
    const client = pool.addClient('app-client', {
      authFlows: {
        adminUserPassword: true
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,

        },
        scopes: [ cognito.OAuthScope.OPENID ],
        callbackUrls: [ 'https://my-app-domain.com/welcome' ],
        logoutUrls: [ 'https://my-app-domain.com/signin' ],
      },
    });

    const httpApi = new apiGateway.HttpApi(this, 'api', {
      apiName: `my-api`,
    });

    const authorizer = new apiGatewayAuthorizers.HttpUserPoolAuthorizer(
      'user-pool-authorizer',
      pool,
      {
        userPoolClients: [client],
        identitySource: ['$request.header.Authorization'],
      },
    );

    const rawDataBucket = new s3.Bucket(this, "rawDataBucket");

    const lambdaFunction = new NodejsFunction(this, 'gen-upload-url', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'main',
      entry: path.join(__dirname, `/../src/gen-upload-url/index.ts`),
      environment: {
        RAW_DATA_BUCKET: rawDataBucket.bucketName,
      }
    });

    httpApi.addRoutes({
      integration: new apiGatewayIntegrations.HttpLambdaIntegration(
        'gen-upload-url',
        lambdaFunction,
      ),
      path: '/gen-upload-url',
      authorizer,
    });

    rawDataBucket.grantPut(lambdaFunction);

    const timeseriesDatabase = new timestream.CfnDatabase(this, "timeseriesDatabase");
    const timeseriesTable = new timestream.CfnTable(this, "timeseriesTable", {
      databaseName: timeseriesDatabase.ref,
      magneticStoreWriteProperties: {
        EnableMagneticStoreWrites: true,
      }
    });

    const parserFunction = new lambda.DockerImageFunction(this, 'parserFunction', {
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, `/../src/parser`)),
      environment: {
        TIMESTREAM_DATABASE_NAME: timeseriesDatabase.ref,
        TIMESTREAM_TABLE_NAME: timeseriesTable.getAtt('Name').toString(),
      },
      timeout: Duration.minutes(15),
    });
    parserFunction.role?.attachInlinePolicy(
      new iam.Policy(this, 'allowWriteTsDb', {
        statements: [
          new iam.PolicyStatement({
          actions: ['timestream:WriteRecords'],
          resources: [timeseriesTable.getAtt('Arn').toString()]
        }),
          new iam.PolicyStatement({
            actions: ['timestream:DescribeEndpoints'],
            resources: ['*']
          })
        ]
      })
    );

    rawDataBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3_notifications.LambdaDestination(parserFunction));
    rawDataBucket.grantRead(parserFunction);

    new CfnOutput(this, "UserPoolId", {
      value: pool.userPoolId,
    })
    new CfnOutput(this, "UserPoolClientId", {
      value: client.userPoolClientId,
    })

    new CfnOutput(this, "UploaderApiGatewayUrl", {
      value: httpApi.url!
    })

    new CfnOutput(this, "RawDataBucketName", {
      value: rawDataBucket.bucketName,
    })

    new CfnOutput(this, "TimeSeriesDatabase", {
      value: timeseriesDatabase.ref,
    })
    new CfnOutput(this, "TimeSeriesTable", {
      value: timeseriesTable.getAtt('Name').toString(),
    })
  }


}
