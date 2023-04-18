import { Aws, IResource, Lazy, Resource } from "../../core";
import * as cloudwatch from '../../aws-cloudwatch';
import * as iam from '../../aws-iam';
import * as kms from '../../aws-kms';
import { DynamoDBMetrics } from './dynamodb-canned-metrics.generated';
import * as perms from './perms';

export const HASH_KEY_TYPE = 'HASH';
export const RANGE_KEY_TYPE = 'RANGE';

// https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Limits.html#limits-secondary-indexes
export const MAX_LOCAL_SECONDARY_INDEX_COUNT = 5;

/**
 * Options for configuring a system errors metric that considers multiple operations.
 */
export interface SystemErrorsForOperationsMetricOptions extends cloudwatch.MetricOptions {

    /**
     * The operations to apply the metric to.
     *
     * @default - All operations available by DynamoDB tables will be considered.
     */
    readonly operations?: Operation[];

}

/**
 * Options for configuring metrics that considers multiple operations.
 */
export interface OperationsMetricOptions extends SystemErrorsForOperationsMetricOptions { }

/**
 * Supported DynamoDB table operations.
 */
export enum Operation {

    /** GetItem */
    GET_ITEM = 'GetItem',

    /** BatchGetItem */
    BATCH_GET_ITEM = 'BatchGetItem',

    /** Scan */
    SCAN = 'Scan',

    /** Query */
    QUERY = 'Query',

    /** GetRecords */
    GET_RECORDS = 'GetRecords',

    /** PutItem */
    PUT_ITEM = 'PutItem',

    /** DeleteItem */
    DELETE_ITEM = 'DeleteItem',

    /** UpdateItem */
    UPDATE_ITEM = 'UpdateItem',

    /** BatchWriteItem */
    BATCH_WRITE_ITEM = 'BatchWriteItem',

    /** TransactWriteItems */
    TRANSACT_WRITE_ITEMS = 'TransactWriteItems',

    /** TransactGetItems */
    TRANSACT_GET_ITEMS = 'TransactGetItems',

    /** ExecuteTransaction */
    EXECUTE_TRANSACTION = 'ExecuteTransaction',

    /** BatchExecuteStatement */
    BATCH_EXECUTE_STATEMENT = 'BatchExecuteStatement',

    /** ExecuteStatement */
    EXECUTE_STATEMENT = 'ExecuteStatement',

}

/**
 * Represents an attribute for describing the key schema for the table
 * and indexes.
 */
export interface Attribute {
    /**
     * The name of an attribute.
     */
    readonly name: string;

    /**
     * The data type of an attribute.
     */
    readonly type: AttributeType;
}

/**
 * What kind of server-side encryption to apply to this table.
 */
export enum TableEncryption {
    /**
     * Server-side KMS encryption with a master key owned by AWS.
     */
    DEFAULT = 'AWS_OWNED',

    /**
     * Server-side KMS encryption with a customer master key managed by customer.
     * If `encryptionKey` is specified, this key will be used, otherwise, one will be defined.
     *
     * > **NOTE**: if `encryptionKey` is not specified and the `Table` construct creates
     * > a KMS key for you, the key will be created with default permissions. If you are using
     * > CDKv2, these permissions will be sufficient to enable the key for use with DynamoDB tables.
     * > If you are using CDKv1, make sure the feature flag `@aws-cdk/aws-kms:defaultKeyPolicies`
     * > is set to `true` in your `cdk.json`.
     */
    CUSTOMER_MANAGED = 'CUSTOMER_MANAGED',

    /**
     * Server-side KMS encryption with a master key managed by AWS.
     */
    AWS_MANAGED = 'AWS_MANAGED',
}

/**
 * Properties for a secondary index
 */
export interface SecondaryIndexProps {
    /**
     * The name of the secondary index.
     */
    readonly indexName: string;

    /**
     * The set of attributes that are projected into the secondary index.
     * @default ALL
     */
    readonly projectionType?: ProjectionType;

    /**
     * The non-key attributes that are projected into the secondary index.
     * @default - No additional attributes
     */
    readonly nonKeyAttributes?: string[];
}

/**
 * Properties for a local secondary index
 */
export interface LocalSecondaryIndexProps extends SecondaryIndexProps {
    /**
     * The attribute of a sort key for the local secondary index.
     */
    readonly sortKey: Attribute;
}

/**
 * An interface that represents a DynamoDB Table - either created with the CDK, or an existing one.
 */
export interface ITable extends IResource {
    /**
     * Arn of the dynamodb table.
     *
     * @attribute
     */
    readonly tableArn: string;

    /**
     * Table name of the dynamodb table.
     *
     * @attribute
     */
    readonly tableName: string;

    /**
     * ARN of the table's stream, if there is one.
     *
     * @attribute
     */
    readonly tableStreamArn?: string;

    /**
     *
     * Optional KMS encryption key associated with this table.
     */
    readonly encryptionKey?: kms.IKey;

    /**
     * Adds an IAM policy statement associated with this table to an IAM
     * principal's policy.
     *
     * If `encryptionKey` is present, appropriate grants to the key needs to be added
     * separately using the `table.encryptionKey.grant*` methods.
     *
     * @param grantee The principal (no-op if undefined)
     * @param actions The set of actions to allow (i.e. "dynamodb:PutItem", "dynamodb:GetItem", ...)
     */
    grant(grantee: iam.IGrantable, ...actions: string[]): iam.Grant;

    /**
     * Adds an IAM policy statement associated with this table's stream to an
     * IAM principal's policy.
     *
     * If `encryptionKey` is present, appropriate grants to the key needs to be added
     * separately using the `table.encryptionKey.grant*` methods.
     *
     * @param grantee The principal (no-op if undefined)
     * @param actions The set of actions to allow (i.e. "dynamodb:DescribeStream", "dynamodb:GetRecords", ...)
     */
    grantStream(grantee: iam.IGrantable, ...actions: string[]): iam.Grant;

    /**
     * Permits an IAM principal all data read operations from this table:
     * BatchGetItem, GetRecords, GetShardIterator, Query, GetItem, Scan.
     *
     * Appropriate grants will also be added to the customer-managed KMS key
     * if one was configured.
     *
     * @param grantee The principal to grant access to
     */
    grantReadData(grantee: iam.IGrantable): iam.Grant;

    /**
     * Permits an IAM Principal to list streams attached to current dynamodb table.
     *
     * @param grantee The principal (no-op if undefined)
     */
    grantTableListStreams(grantee: iam.IGrantable): iam.Grant;

    /**
     * Permits an IAM principal all stream data read operations for this
     * table's stream:
     * DescribeStream, GetRecords, GetShardIterator, ListStreams.
     *
     * Appropriate grants will also be added to the customer-managed KMS key
     * if one was configured.
     *
     * @param grantee The principal to grant access to
     */
    grantStreamRead(grantee: iam.IGrantable): iam.Grant;

    /**
     * Permits an IAM principal all data write operations to this table:
     * BatchWriteItem, PutItem, UpdateItem, DeleteItem.
     *
     * Appropriate grants will also be added to the customer-managed KMS key
     * if one was configured.
     *
     * @param grantee The principal to grant access to
     */
    grantWriteData(grantee: iam.IGrantable): iam.Grant;

    /**
     * Permits an IAM principal to all data read/write operations to this table.
     * BatchGetItem, GetRecords, GetShardIterator, Query, GetItem, Scan,
     * BatchWriteItem, PutItem, UpdateItem, DeleteItem
     *
     * Appropriate grants will also be added to the customer-managed KMS key
     * if one was configured.
     *
     * @param grantee The principal to grant access to
     */
    grantReadWriteData(grantee: iam.IGrantable): iam.Grant;

    /**
     * Permits all DynamoDB operations ("dynamodb:*") to an IAM principal.
     *
     * Appropriate grants will also be added to the customer-managed KMS key
     * if one was configured.
     *
     * @param grantee The principal to grant access to
     */
    grantFullAccess(grantee: iam.IGrantable): iam.Grant;

    /**
     * Metric for the number of Errors executing all Lambdas
     */
    metric(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric;

    /**
     * Metric for the consumed read capacity units
     *
     * @param props properties of a metric
     */
    metricConsumedReadCapacityUnits(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

    /**
     * Metric for the consumed write capacity units
     *
     * @param props properties of a metric
     */
    metricConsumedWriteCapacityUnits(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

    /**
     * Metric for the system errors
     *
     * @param props properties of a metric
     *
     * @deprecated use `metricSystemErrorsForOperations`
     */
    metricSystemErrors(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

    /**
     * Metric for the system errors this table
     *
     * @param props properties of a metric
     *
     */
    metricSystemErrorsForOperations(props?: SystemErrorsForOperationsMetricOptions): cloudwatch.IMetric;

    /**
     * Metric for the user errors
     *
     * @param props properties of a metric
     */
    metricUserErrors(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

    /**
     * Metric for the conditional check failed requests
     *
     * @param props properties of a metric
     */
    metricConditionalCheckFailedRequests(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

    /**
     * Metric for throttled requests
     *
     * @param props properties of a metric
     *
     * @deprecated use `metricThrottledRequestsForOperations`
     */
    metricThrottledRequests(props?: cloudwatch.MetricOptions): cloudwatch.Metric;

    /**
     * Metric for throttled requests
     *
     * @param props properties of a metric
     *
     */
    metricThrottledRequestsForOperations(props?: OperationsMetricOptions): cloudwatch.IMetric;

    /**
     * Metric for the successful request latency
     *
     * @param props properties of a metric
     *
     */
    metricSuccessfulRequestLatency(props?: cloudwatch.MetricOptions): cloudwatch.Metric;
}

/**
 * Reference to a dynamodb table.
 */
export interface TableAttributes {
    /**
     * The ARN of the dynamodb table.
     * One of this, or `tableName`, is required.
     *
     * @default - no table arn
     */
    readonly tableArn?: string;

    /**
     * The table name of the dynamodb table.
     * One of this, or `tableArn`, is required.
     *
     * @default - no table name
     */
    readonly tableName?: string;

    /**
     * The ARN of the table's stream.
     *
     * @default - no table stream
     */
    readonly tableStreamArn?: string;

    /**
     * KMS encryption key, if this table uses a customer-managed encryption key.
     *
     * @default - no key
     */
    readonly encryptionKey?: kms.IKey;

    /**
     * The name of the global indexes set for this Table.
     * Note that you need to set either this property,
     * or `localIndexes`,
     * if you want methods like grantReadData()
     * to grant permissions for indexes as well as the table itself.
     *
     * @default - no global indexes
     */
    readonly globalIndexes?: string[];

    /**
     * The name of the local indexes set for this Table.
     * Note that you need to set either this property,
     * or `globalIndexes`,
     * if you want methods like grantReadData()
     * to grant permissions for indexes as well as the table itself.
     *
     * @default - no local indexes
     */
    readonly localIndexes?: string[];

    /**
     * If set to true, grant methods always grant permissions for all indexes.
     * If false is provided, grant methods grant the permissions
     * only when `globalIndexes` or `localIndexes` is specified.
     *
     * @default - false
     */
    readonly grantIndexPermissions?: boolean;
}

export abstract class TableBase extends Resource implements ITable {
    /**
     * @attribute
     */
    public abstract readonly tableArn: string;

    /**
     * @attribute
     */
    public abstract readonly tableName: string;

    /**
     * @attribute
     */
    public abstract readonly tableStreamArn?: string;

    /**
     * KMS encryption key, if this table uses a customer-managed encryption key.
     */
    public abstract readonly encryptionKey?: kms.IKey;

    protected readonly regionalArns = new Array<string>();

    /**
     * Adds an IAM policy statement associated with this table to an IAM
     * principal's policy.
     *
     * If `encryptionKey` is present, appropriate grants to the key needs to be added
     * separately using the `table.encryptionKey.grant*` methods.
     *
     * @param grantee The principal (no-op if undefined)
     * @param actions The set of actions to allow (i.e. "dynamodb:PutItem", "dynamodb:GetItem", ...)
     */
    public grant(grantee: iam.IGrantable, ...actions: string[]): iam.Grant {
        return iam.Grant.addToPrincipal({
            grantee,
            actions,
            resourceArns: [
                this.tableArn,
                Lazy.string({ produce: () => this.hasIndex ? `${this.tableArn}/index/*` : Aws.NO_VALUE }),
                ...this.regionalArns,
                ...this.regionalArns.map(arn => Lazy.string({
                    produce: () => this.hasIndex ? `${arn}/index/*` : Aws.NO_VALUE,
                })),
            ],
            scope: this,
        });
    }

    /**
     * Adds an IAM policy statement associated with this table's stream to an
     * IAM principal's policy.
     *
     * If `encryptionKey` is present, appropriate grants to the key needs to be added
     * separately using the `table.encryptionKey.grant*` methods.
     *
     * @param grantee The principal (no-op if undefined)
     * @param actions The set of actions to allow (i.e. "dynamodb:DescribeStream", "dynamodb:GetRecords", ...)
     */
    public grantStream(grantee: iam.IGrantable, ...actions: string[]): iam.Grant {
        if (!this.tableStreamArn) {
            throw new Error(`DynamoDB Streams must be enabled on the table ${this.node.path}`);
        }

        return iam.Grant.addToPrincipal({
            grantee,
            actions,
            resourceArns: [this.tableStreamArn],
            scope: this,
        });
    }

    /**
     * Permits an IAM principal all data read operations from this table:
     * BatchGetItem, GetRecords, GetShardIterator, Query, GetItem, Scan, DescribeTable.
     *
     * Appropriate grants will also be added to the customer-managed KMS key
     * if one was configured.
     *
     * @param grantee The principal to grant access to
     */
    public grantReadData(grantee: iam.IGrantable): iam.Grant {
        const tableActions = perms.READ_DATA_ACTIONS.concat(perms.DESCRIBE_TABLE);
        return this.combinedGrant(grantee, { keyActions: perms.KEY_READ_ACTIONS, tableActions });
    }

    /**
     * Permits an IAM Principal to list streams attached to current dynamodb table.
     *
     * @param grantee The principal (no-op if undefined)
     */
    public grantTableListStreams(grantee: iam.IGrantable): iam.Grant {
        if (!this.tableStreamArn) {
            throw new Error(`DynamoDB Streams must be enabled on the table ${this.node.path}`);
        }

        return iam.Grant.addToPrincipal({
            grantee,
            actions: ['dynamodb:ListStreams'],
            resourceArns: ['*'],
        });
    }

    /**
     * Permits an IAM principal all stream data read operations for this
     * table's stream:
     * DescribeStream, GetRecords, GetShardIterator, ListStreams.
     *
     * Appropriate grants will also be added to the customer-managed KMS key
     * if one was configured.
     *
     * @param grantee The principal to grant access to
     */
    public grantStreamRead(grantee: iam.IGrantable): iam.Grant {
        this.grantTableListStreams(grantee);
        return this.combinedGrant(grantee, { keyActions: perms.KEY_READ_ACTIONS, streamActions: perms.READ_STREAM_DATA_ACTIONS });
    }

    /**
     * Permits an IAM principal all data write operations to this table:
     * BatchWriteItem, PutItem, UpdateItem, DeleteItem, DescribeTable.
     *
     * Appropriate grants will also be added to the customer-managed KMS key
     * if one was configured.
     *
     * @param grantee The principal to grant access to
     */
    public grantWriteData(grantee: iam.IGrantable): iam.Grant {
        const tableActions = perms.WRITE_DATA_ACTIONS.concat(perms.DESCRIBE_TABLE);
        const keyActions = perms.KEY_READ_ACTIONS.concat(perms.KEY_WRITE_ACTIONS);
        return this.combinedGrant(grantee, { keyActions, tableActions });
    }

    /**
     * Permits an IAM principal to all data read/write operations to this table.
     * BatchGetItem, GetRecords, GetShardIterator, Query, GetItem, Scan,
     * BatchWriteItem, PutItem, UpdateItem, DeleteItem, DescribeTable
     *
     * Appropriate grants will also be added to the customer-managed KMS key
     * if one was configured.
     *
     * @param grantee The principal to grant access to
     */
    public grantReadWriteData(grantee: iam.IGrantable): iam.Grant {
        const tableActions = perms.READ_DATA_ACTIONS.concat(perms.WRITE_DATA_ACTIONS).concat(perms.DESCRIBE_TABLE);
        const keyActions = perms.KEY_READ_ACTIONS.concat(perms.KEY_WRITE_ACTIONS);
        return this.combinedGrant(grantee, { keyActions, tableActions });
    }

    /**
     * Permits all DynamoDB operations ("dynamodb:*") to an IAM principal.
     *
     * Appropriate grants will also be added to the customer-managed KMS key
     * if one was configured.
     *
     * @param grantee The principal to grant access to
     */
    public grantFullAccess(grantee: iam.IGrantable) {
        const keyActions = perms.KEY_READ_ACTIONS.concat(perms.KEY_WRITE_ACTIONS);
        return this.combinedGrant(grantee, { keyActions, tableActions: ['dynamodb:*'] });
    }

    /**
     * Return the given named metric for this Table
     *
     * By default, the metric will be calculated as a sum over a period of 5 minutes.
     * You can customize this by using the `statistic` and `period` properties.
     */
    public metric(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric {
        return new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName,
            dimensionsMap: {
                TableName: this.tableName,
            },
            ...props,
        }).attachTo(this);
    }

    /**
     * Metric for the consumed read capacity units this table
     *
     * By default, the metric will be calculated as a sum over a period of 5 minutes.
     * You can customize this by using the `statistic` and `period` properties.
     */
    public metricConsumedReadCapacityUnits(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
        return this.cannedMetric(DynamoDBMetrics.consumedReadCapacityUnitsSum, props);
    }

    /**
     * Metric for the consumed write capacity units this table
     *
     * By default, the metric will be calculated as a sum over a period of 5 minutes.
     * You can customize this by using the `statistic` and `period` properties.
     */
    public metricConsumedWriteCapacityUnits(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
        return this.cannedMetric(DynamoDBMetrics.consumedWriteCapacityUnitsSum, props);
    }

    /**
     * Metric for the system errors this table
     *
     * @deprecated use `metricSystemErrorsForOperations`.
     */
    public metricSystemErrors(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
        if (!props?.dimensionsMap?.Operation && !props?.dimensionsMap?.Operation) {
            // 'Operation' must be passed because its an operational metric.
            throw new Error("'Operation' dimension must be passed for the 'SystemErrors' metric.");
        }

        const dimensionsMap = {
            TableName: this.tableName,
            ...props?.dimensionsMap ?? {},
            ...props?.dimensionsMap ?? {},
        };

        return this.metric('SystemErrors', { statistic: 'sum', ...props, dimensionsMap });
    }

    /**
     * Metric for the user errors. Note that this metric reports user errors across all
     * the tables in the account and region the table resides in.
     *
     * By default, the metric will be calculated as a sum over a period of 5 minutes.
     * You can customize this by using the `statistic` and `period` properties.
     */
    public metricUserErrors(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
        if (props?.dimensionsMap) {
            throw new Error("'dimensions' is not supported for the 'UserErrors' metric");
        }

        // overriding 'dimensions' here because this metric is an account metric.
        // see 'UserErrors' in https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/metrics-dimensions.html
        return this.metric('UserErrors', { statistic: 'sum', ...props, dimensionsMap: {} });
    }

    /**
     * Metric for the conditional check failed requests this table
     *
     * By default, the metric will be calculated as a sum over a period of 5 minutes.
     * You can customize this by using the `statistic` and `period` properties.
     */
    public metricConditionalCheckFailedRequests(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
        return this.metric('ConditionalCheckFailedRequests', { statistic: 'sum', ...props });
    }

    /**
     * How many requests are throttled on this table
     *
     * Default: sum over 5 minutes
     *
     * @deprecated Do not use this function. It returns an invalid metric. Use `metricThrottledRequestsForOperation` instead.
     */
    public metricThrottledRequests(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
        return this.metric('ThrottledRequests', { statistic: 'sum', ...props });
    }

    /**
     * Metric for the successful request latency this table.
     *
     * By default, the metric will be calculated as an average over a period of 5 minutes.
     * You can customize this by using the `statistic` and `period` properties.
     */
    public metricSuccessfulRequestLatency(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
        if (!props?.dimensionsMap?.Operation && !props?.dimensionsMap?.Operation) {
            throw new Error("'Operation' dimension must be passed for the 'SuccessfulRequestLatency' metric.");
        }

        const dimensionsMap = {
            TableName: this.tableName,
            Operation: props.dimensionsMap?.Operation ?? props.dimensionsMap?.Operation,
        };

        return new cloudwatch.Metric({
            ...DynamoDBMetrics.successfulRequestLatencyAverage(dimensionsMap),
            ...props,
            dimensionsMap,
        }).attachTo(this);
    }

    /**
     * How many requests are throttled on this table, for the given operation
     *
     * Default: sum over 5 minutes
     */
    public metricThrottledRequestsForOperation(operation: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric {
        return new cloudwatch.Metric({
            ...DynamoDBMetrics.throttledRequestsSum({ Operation: operation, TableName: this.tableName }),
            ...props,
        }).attachTo(this);
    }

    /**
     * How many requests are throttled on this table.
     *
     * This will sum errors across all possible operations.
     * Note that by default, each individual metric will be calculated as a sum over a period of 5 minutes.
     * You can customize this by using the `statistic` and `period` properties.
     */
    public metricThrottledRequestsForOperations(props?: OperationsMetricOptions): cloudwatch.IMetric {
        return this.sumMetricsForOperations('ThrottledRequests', 'Sum of throttled requests across all operations', props);
    }

    /**
     * Metric for the system errors this table.
     *
     * This will sum errors across all possible operations.
     * Note that by default, each individual metric will be calculated as a sum over a period of 5 minutes.
     * You can customize this by using the `statistic` and `period` properties.
     */
    public metricSystemErrorsForOperations(props?: SystemErrorsForOperationsMetricOptions): cloudwatch.IMetric {
        return this.sumMetricsForOperations('SystemErrors', 'Sum of errors across all operations', props);
    }

    /**
     * Create a math expression for operations.
     *
     * @param metricName The metric name.
     * @param expressionLabel Label for expression
     * @param props operation list
     */
    private sumMetricsForOperations(metricName: string, expressionLabel: string, props?: OperationsMetricOptions): cloudwatch.IMetric {
        if (props?.dimensionsMap?.Operation) {
            throw new Error("The Operation dimension is not supported. Use the 'operations' property.");
        }

        const operations = props?.operations ?? Object.values(Operation);

        const values = this.createMetricsForOperations(metricName, operations, { statistic: 'sum', ...props });

        const sum = new cloudwatch.MathExpression({
            expression: `${Object.keys(values).join(' + ')}`,
            usingMetrics: { ...values },
            color: props?.color,
            label: expressionLabel,
            period: props?.period,
        });

        return sum;
    }

    /**
     * Create a map of metrics that can be used in a math expression.
     *
     * Using the return value of this function as the `usingMetrics` property in `cloudwatch.MathExpression` allows you to
     * use the keys of this map as metric names inside you expression.
     *
     * @param metricName The metric name.
     * @param operations The list of operations to create metrics for.
     * @param props Properties for the individual metrics.
     * @param metricNameMapper Mapper function to allow controlling the individual metric name per operation.
     */
    private createMetricsForOperations(metricName: string, operations: Operation[],
        props?: cloudwatch.MetricOptions, metricNameMapper?: (op: Operation) => string): Record<string, cloudwatch.IMetric> {

        const metrics: Record<string, cloudwatch.IMetric> = {};

        const mapper = metricNameMapper ?? (op => op.toLowerCase());

        if (props?.dimensionsMap?.Operation) {
            throw new Error('Invalid properties. Operation dimension is not supported when calculating operational metrics');
        }

        for (const operation of operations) {

            const metric = this.metric(metricName, {
                ...props,
                dimensionsMap: {
                    TableName: this.tableName,
                    Operation: operation,
                    ...props?.dimensionsMap,
                },
            });

            const operationMetricName = mapper(operation);
            const firstChar = operationMetricName.charAt(0);

            if (firstChar === firstChar.toUpperCase()) {
                // https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/using-metric-math.html#metric-math-syntax
                throw new Error(`Mapper generated an illegal operation metric name: ${operationMetricName}. Must start with a lowercase letter`);
            }

            metrics[operationMetricName] = metric;
        }

        return metrics;
    }

    protected abstract get hasIndex(): boolean;

    /**
     * Adds an IAM policy statement associated with this table to an IAM
     * principal's policy.
     * @param grantee The principal (no-op if undefined)
     * @param opts Options for keyActions, tableActions and streamActions
     */
    private combinedGrant(
        grantee: iam.IGrantable,
        opts: { keyActions?: string[], tableActions?: string[], streamActions?: string[] },
    ): iam.Grant {
        if (this.encryptionKey && opts.keyActions) {
            this.encryptionKey.grant(grantee, ...opts.keyActions);
        }
        if (opts.tableActions) {
            const resources = [this.tableArn,
            Lazy.string({ produce: () => this.hasIndex ? `${this.tableArn}/index/*` : Aws.NO_VALUE }),
            ...this.regionalArns,
            ...this.regionalArns.map(arn => Lazy.string({
                produce: () => this.hasIndex ? `${arn}/index/*` : Aws.NO_VALUE,
            }))];
            const ret = iam.Grant.addToPrincipal({
                grantee,
                actions: opts.tableActions,
                resourceArns: resources,
                scope: this,
            });
            return ret;
        }
        if (opts.streamActions) {
            if (!this.tableStreamArn) {
                throw new Error(`DynamoDB Streams must be enabled on the table ${this.node.path}`);
            }
            const resources = [this.tableStreamArn];
            const ret = iam.Grant.addToPrincipal({
                grantee,
                actions: opts.streamActions,
                resourceArns: resources,
                scope: this,
            });
            return ret;
        }
        throw new Error(`Unexpected 'action', ${opts.tableActions || opts.streamActions}`);
    }

    private cannedMetric(
        fn: (dims: { TableName: string }) => cloudwatch.MetricProps,
        props?: cloudwatch.MetricOptions): cloudwatch.Metric {
        return new cloudwatch.Metric({
            ...fn({ TableName: this.tableName }),
            ...props,
        }).attachTo(this);
    }
}

/**
 * Data types for attributes within a table
 *
 * @see https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.NamingRulesDataTypes.html#HowItWorks.DataTypes
 */
export enum AttributeType {
    /** Up to 400KiB of binary data (which must be encoded as base64 before sending to DynamoDB) */
    BINARY = 'B',
    /** Numeric values made of up to 38 digits (positive, negative or zero) */
    NUMBER = 'N',
    /** Up to 400KiB of UTF-8 encoded text */
    STRING = 'S',
}

/**
 * DynamoDB's Read/Write capacity modes.
 */
export enum BillingMode {
    /**
     * Pay only for what you use. You don't configure Read/Write capacity units.
     */
    PAY_PER_REQUEST = 'PAY_PER_REQUEST',
    /**
     * Explicitly specified Read/Write capacity units.
     */
    PROVISIONED = 'PROVISIONED',
}

/**
 * The set of attributes that are projected into the index
 *
 * @see https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Projection.html
 */
export enum ProjectionType {
    /** Only the index and primary keys are projected into the index. */
    KEYS_ONLY = 'KEYS_ONLY',
    /** Only the specified table attributes are projected into the index. The list of projected attributes is in `nonKeyAttributes`. */
    INCLUDE = 'INCLUDE',
    /** All of the table attributes are projected into the index. */
    ALL = 'ALL'
}

/**
 * When an item in the table is modified, StreamViewType determines what information
 * is written to the stream for this table.
 *
 * @see https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_StreamSpecification.html
 */
export enum StreamViewType {
    /** The entire item, as it appears after it was modified, is written to the stream. */
    NEW_IMAGE = 'NEW_IMAGE',
    /** The entire item, as it appeared before it was modified, is written to the stream. */
    OLD_IMAGE = 'OLD_IMAGE',
    /** Both the new and the old item images of the item are written to the stream. */
    NEW_AND_OLD_IMAGES = 'NEW_AND_OLD_IMAGES',
    /** Only the key attributes of the modified item are written to the stream. */
    KEYS_ONLY = 'KEYS_ONLY'
}

/**
 * DynamoDB's table class.
 *
 * @see https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.TableClasses.html
 */
export enum TableClass {
    /** Default table class for DynamoDB. */
    STANDARD = 'STANDARD',

    /** Table class for DynamoDB that reduces storage costs compared to existing DynamoDB Standard tables. */
    STANDARD_INFREQUENT_ACCESS = 'STANDARD_INFREQUENT_ACCESS',
}