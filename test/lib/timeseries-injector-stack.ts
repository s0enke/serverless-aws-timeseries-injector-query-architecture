import {CfnOutput, CfnParameter, Stack, StackProps} from "aws-cdk-lib";
import {Construct} from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as cr from "aws-cdk-lib/custom-resources";

export class IntegrationTestsFixturesStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const userPoolId = new CfnParameter(this, "UserPoolId")

    const user = new cognito.CfnUserPoolUser(this, 'Pool', {
      userPoolId: userPoolId.valueAsString,
    });

    new cr.AwsCustomResource(this, 'SetUserPoolUserPassword', {
      onCreate: {
        service: 'CognitoIdentityServiceProvider',
        action: 'adminSetUserPassword',
        physicalResourceId: cr.PhysicalResourceId.of('SetUserPoolUserPassword'),
        parameters: {
          UserPoolId: userPoolId.valueAsString,
          Username: user.ref,
          Password: "I$oldeMaWidderB4d3n",
          Permanent: true,
        }
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    new CfnOutput(this, "UserPoolUsername", {
      value: user.ref,
    })

  }
}
