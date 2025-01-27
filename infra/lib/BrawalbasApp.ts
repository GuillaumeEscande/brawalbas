import * as cdk from 'aws-cdk-lib';
import { CoreStack } from '../lib/core';
import { BackendStack } from '../lib/backend';
import { FrontendStack } from '../lib/frontend';


import path = require('path');

interface BrawalbasAppProps extends cdk.StackProps {
  account: string,
  region: string,
  domainName: string
  appName: string
}

export class BrawalbasApp extends cdk.App {
  constructor(props: BrawalbasAppProps) {
    super();
    const env = {
      account: props.account,
      region: props.region
    }

    const core = new CoreStack(this, props.appName + 'CoreStack', {
      env: env,
      domainName: props.domainName,
      appName: props.appName,
    });
    
    const backend = new BackendStack(this, props.appName + 'BackendStack', {
      env: env,
      hostedZone: core.hostedZone,
      certificate: core.certificate,
      userpool: core.userPool,
      appName: props.appName,
    });

    const frontend = new FrontendStack(this, props.appName + 'FrontendStack', {
      env: env,
      appName: props.appName,
      hostedZone: core.hostedZone,
      certificate: core.certificate,
      userPool: core.userPool,
      appClient: core.appClient,
    });
  }
}
