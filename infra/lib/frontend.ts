import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3_deployment from "aws-cdk-lib/aws-s3-deployment";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as cloudfront_origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as certificatemanager from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Duration } from 'aws-cdk-lib';
import path = require('path');

interface FrontendProps extends cdk.StackProps {
  userPool: cognito.IUserPool,
  appClient: cognito.UserPoolClient,
  hostedZone: route53.IHostedZone,
  certificate: certificatemanager.ICertificate,
  appName: string,
}

export class FrontendStack extends cdk.Stack {

  public readonly bucket: s3.IBucket;
  public readonly deployment: s3_deployment.BucketDeployment;
  public readonly distribution: cloudfront.IDistribution;
  public readonly userPool: cognito.IUserPool;
  public readonly appClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: FrontendProps) {
    super(scope, id, props);

    this.userPool = props.userPool;
    this.appClient = props.appClient;


    this. bucket = new s3.Bucket(this, props.appName + 'Bucket', {
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      accessControl: s3.BucketAccessControl.PRIVATE,
      websiteIndexDocument: 'index.html',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      //versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    this.deployment = new s3_deployment.BucketDeployment(this, props.appName + 'BucketDeployment', {
      destinationBucket: this.bucket,
      sources: [
        s3_deployment.Source.asset('../frontend',{
          bundling: {
            environment: {
              VITE_USER_POOL_ID: this.userPool.userPoolId,
              VITE_USER_POOL_CLIENT_ID: this.appClient.userPoolClientId,
              VITE_USER_POOL_ENDPOINT: 'https://cognito-idp.' + this.region + '.amazonaws.com/',
            },
            image: cdk.DockerImage.fromRegistry('node:lts'),
            command: [
              'bash', '-c', [
                'env',
                'npm install',
                'npm run build',
                'cp -r /asset-input/dist/* /asset-output/',
              ].join(' && '),
            ]
          }
        })
      ],
    });

    //const s3origin = new cloudfront_origins.S3StaticWebsiteOrigin(bucket);

    this.distribution = new cloudfront.Distribution(this, props.appName + 'Distribution', {
      certificate: props.certificate,
      domainNames: [props.hostedZone.zoneName, `www.${props.hostedZone.zoneName}`],
      defaultRootObject: 'index.html',
      defaultBehavior: {
        //origin: s3origin ,
        origin: new cloudfront_origins.OriginGroup({
          primaryOrigin: cloudfront_origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
          fallbackOrigin: new cloudfront_origins.HttpOrigin(`www.${props.hostedZone.zoneName}`),
          // optional, defaults to: 500, 502, 503 and 504
          fallbackStatusCodes: [404],
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED
      },
    });

    const route53Target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution));
    
    // Create route53 A record, pointing to CloudFront distribution 👇
    const domainARecord = new route53.ARecord(this, props.appName + 'ARecord', {
      target: route53Target,
      recordName: props.hostedZone.zoneName,
      zone: props.hostedZone,
      ttl: Duration.days(1),
      comment: `A Record for ${props.hostedZone.zoneName}`,
    });
    domainARecord.node.addDependency(this.distribution);

    // Route53 www record, pointing to CloudFront distribution 👇
    const wwwARecord = new route53.ARecord(this, props.appName + 'WWWARecord', {
      target: route53Target,
      recordName: 'www',
      zone: props.hostedZone,
      ttl: Duration.days(1),
      comment: `A Record for www.${props.hostedZone.zoneName}`,
    });
    wwwARecord.node.addDependency(this.distribution);


  }
}
