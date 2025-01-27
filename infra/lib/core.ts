import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as certificatemanager from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as cognito from 'aws-cdk-lib/aws-cognito';
import path = require('path');

interface CoreProps extends cdk.StackProps {
  domainName: string,
  appName: string,
}

export class CoreStack extends cdk.Stack {
  public readonly userPool: cognito.IUserPool;
  public readonly appClient: cognito.UserPoolClient;
  public readonly hostedZone: route53.IHostedZone;
  public readonly certificate: certificatemanager.ICertificate;

  constructor(scope: Construct, id: string, props: CoreProps) {
    super(scope, id, props);

    this.userPool = new cognito.UserPool(this, props.appName + 'userPool', {
      selfSignUpEnabled: true,
      autoVerify: {
        email: true,
      },
      userVerification: {
        emailSubject: 'You need to verify your email',
        emailBody: 'Thanks for signing up Your verification code is {####}', // # This placeholder is a must if code is selected as preferred verification method
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.appClient = this.userPool.addClient(props.appName + 'frontend', {
      authFlows: {
        userPassword: true,
        userSrp: true
      }
    });

    this.hostedZone = route53.HostedZone.fromLookup(this, props.appName + 'HostedZone', {
      domainName: props.domainName,
    });

    this.certificate = new certificatemanager.Certificate(this, props.appName + 'Certificate', {
      domainName: this.hostedZone.zoneName,
      subjectAlternativeNames: [`www.${this.hostedZone.zoneName}`, `api.${this.hostedZone.zoneName}`],
      validation: certificatemanager.CertificateValidation.fromDns(this.hostedZone), // Perform DNS validation in the given hosted zone
    });
    this.certificate.node.addDependency(this.hostedZone);
  }
}
