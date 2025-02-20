import { WebSocketApi, WebSocketStage } from '@aws-cdk/aws-apigatewayv2-alpha';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { App, CfnOutput, Stack } from 'aws-cdk-lib';
import { WebSocketLambdaIntegration } from '../../lib';

/*
 * Stack verification steps:
 * 1. Connect: 'wscat -c <endpoint-in-the-stack-output>'. Should connect successfully and print event data containing connectionId in cloudwatch
 * 2. SendMessage: '> {"action": "sendmessage", "data": "some-data"}'. Should send the message successfully and print the data in cloudwatch
 * 3. Default: '> {"data": "some-data"}'. Should send the message successfully and print the data in cloudwatch
 * 4. Disconnect: disconnect from the wscat. Should print event data containing connectionId in cloudwatch
 */

const app = new App();
const stack = new Stack(app, 'WebSocketApiInteg');

const connectHandler = new lambda.Function(stack, 'ConnectHandler', {
  runtime: lambda.Runtime.NODEJS_14_X,
  handler: 'index.handler',
  code: new lambda.InlineCode('exports.handler = async function(event, context) { console.log(event); return { statusCode: 200, body: "connected" }; };'),
});

const disconnetHandler = new lambda.Function(stack, 'DisconnectHandler', {
  runtime: lambda.Runtime.NODEJS_14_X,
  handler: 'index.handler',
  code: new lambda.InlineCode('exports.handler = async function(event, context) { console.log(event); return { statusCode: 200, body: "disconnected" }; };'),
});

const defaultHandler = new lambda.Function(stack, 'DefaultHandler', {
  runtime: lambda.Runtime.NODEJS_14_X,
  handler: 'index.handler',
  code: new lambda.InlineCode('exports.handler = async function(event, context) { console.log(event); return { statusCode: 200, body: "default" }; };'),
});

const messageHandler = new lambda.Function(stack, 'MessageHandler', {
  runtime: lambda.Runtime.NODEJS_14_X,
  handler: 'index.handler',
  code: new lambda.InlineCode('exports.handler = async function(event, context) { console.log(event); return { statusCode: 200, body: "received" }; };'),
});

const webSocketApi = new WebSocketApi(stack, 'mywsapi', {
  connectRouteOptions: { integration: new WebSocketLambdaIntegration('ConnectIntegration', connectHandler) },
  disconnectRouteOptions: { integration: new WebSocketLambdaIntegration('DisconnectIntegration', disconnetHandler) },
  defaultRouteOptions: { integration: new WebSocketLambdaIntegration('DefaultIntegration', defaultHandler) },
});
const stage = new WebSocketStage(stack, 'mystage', {
  webSocketApi,
  stageName: 'dev',
  autoDeploy: true,
});

webSocketApi.addRoute('sendmessage', { integration: new WebSocketLambdaIntegration('SendMessageIntegration', messageHandler) });

new CfnOutput(stack, 'ApiEndpoint', { value: stage.url });
