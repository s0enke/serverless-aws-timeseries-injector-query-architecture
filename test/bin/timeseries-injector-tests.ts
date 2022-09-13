#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { IntegrationTestsFixturesStack } from '../lib/timeseries-injector-stack';

const app = new cdk.App();
new IntegrationTestsFixturesStack(app, 'IntegrationTestsFixtures');