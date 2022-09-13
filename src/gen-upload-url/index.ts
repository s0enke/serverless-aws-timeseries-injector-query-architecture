
import * as AWS from 'aws-sdk';
/* eslint-disable @typescript-eslint/require-await */
import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from 'aws-lambda';

export async function main(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const sensor_id = event.queryStringParameters.sensor_id! as string

  const s3 = new AWS.S3();
  const signedUrl = s3.getSignedUrl("putObject", {
    Bucket: process.env['RAW_DATA_BUCKET']! as string,
    Key: `${sensor_id}/uuid-id`,
  });

  return {
    body: JSON.stringify({upload_url: signedUrl}),
    statusCode: 200,
  };

}