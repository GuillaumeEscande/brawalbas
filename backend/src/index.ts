import { Context, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});

let tableName = process.env.DDB_TABLE_NAME

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {


    const ddbDocClient = DynamoDBDocumentClient.from(client);

    await ddbDocClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          noteId: "TEST " + new Date(),
          userId: "TEST"
        },
      })
    );
  
  
    const count = await ddbDocClient.send(
      new ScanCommand({
        TableName: tableName,
        Select: "COUNT",
      })
    );
  
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ message: "Hello, World! " + count.Count }),
    };
  };