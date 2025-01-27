import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as certificatemanager from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Duration } from 'aws-cdk-lib';
import path = require('path');
import { AllowedMethods } from 'aws-cdk-lib/aws-cloudfront';

interface BackendProps extends cdk.StackProps {
  hostedZone: route53.IHostedZone,
  certificate: certificatemanager.ICertificate,
  userpool: cognito.IUserPool,
  appName: string,
}

export class BackendStack extends cdk.Stack {

  public readonly dynamoTable: dynamodb.ITable;
  public readonly rootLambda: lambda.Function;
  public readonly api: apigateway.LambdaRestApi;
  public readonly helloResource: apigateway.Resource;
  
  constructor(scope: Construct, id: string, props: BackendProps) {
    super(scope, id, props);

    this.dynamoTable = new dynamodb.Table(this, props.appName + "Table", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Use on-demand billing mode
      sortKey: { name: "noteId", type: dynamodb.AttributeType.STRING },
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });


    // Define the Lambda function resource
    this.rootLambda = new lambda.Function(this, props.appName + 'RootLambda', {
      runtime: lambda.Runtime.NODEJS_20_X, // Choose any supported Node.js runtime
      architecture: lambda.Architecture.ARM_64,
      code: lambda.Code.fromAsset('../backend', {
          bundling: {
            image: cdk.DockerImage.fromRegistry('node:lts'),
            command: [
              'bash', '-c', [
                'npm install',
                'npm run build',
                'cp -r /asset-input/dist/index.js /asset-output/',
              ].join(' && '),
            ]
          }
        }
      ), // Points to the lambda directory
      handler: 'index.handler', // Points to the 'hello' file in the lambda directory
    });

    this.rootLambda.addEnvironment("DDB_TABLE_NAME", this.dynamoTable.tableName);
    this.dynamoTable.grantReadWriteData(this.rootLambda.grantPrincipal);


    
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, props.appName + 'Authorizer', {
      cognitoUserPools: [props.userpool]
    });

    // Define the API Gateway resource
    this.api = new apigateway.LambdaRestApi(this, props.appName + 'RootApi', {
      handler: this.rootLambda,
      defaultMethodOptions: {
          authorizationType: apigateway.AuthorizationType.COGNITO,
          authorizer: authorizer
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS
      },
    });

    const domain =  new apigateway.DomainName(this, props.appName + 'ApiDomain', {
      domainName: `api.${props.hostedZone.zoneName}`,
      certificate: props.certificate,
    });
    
    
    new apigateway.BasePathMapping(this, props.appName + 'ApiMapping', {
      domainName: domain,
      restApi: this.api,
    })

    const apiARecord = new route53.ARecord(this, props.appName + 'APIRecord', {
      target: route53.RecordTarget.fromAlias(new targets.ApiGatewayDomain(domain)),
      recordName: 'api',
      zone: props.hostedZone,
      ttl: Duration.days(1),
      comment: `A Record for api.${props.hostedZone.zoneName}`,
    });

  }
}
