from diagrams import Cluster, Diagram, Edge
from diagrams.aws.engagement import SimpleEmailServiceSesEmail, SimpleEmailServiceSes
from diagrams.aws.storage import SimpleStorageServiceS3Bucket
from diagrams.aws.database import Timestream, DynamodbTable
from diagrams.aws.compute import LambdaFunction
from diagrams.aws.integration import SimpleQueueServiceSqsQueue, SimpleQueueServiceSqsMessage
from diagrams.aws.integration import Eventbridge, StepFunctions
from diagrams.aws.general import TraditionalServer
from diagrams.aws.network import APIGateway

graph_attr_custom = {
    "layout": "dot"
}

with Diagram("Timeseries Injector", show=True, graph_attr=graph_attr_custom):

    with Cluster("Timeseries Database"):
        timeseries_table = DynamodbTable("Table")
        Timestream("Timeseries Database\n(Amazon Timestream)")

    with Cluster("Tenant data"):
        tenant_table = DynamodbTable("DynamoDB tenant table [tenant_id, injector_type, injector_data]")

    with Cluster("Raw data"):
        parser_queue = SimpleQueueServiceSqsQueue("Parser Queue")
        raw_data = SimpleStorageServiceS3Bucket("Raw data")
        raw_data >> Edge(label="emits event on new object") >> parser_queue

    with Cluster("Parser"):
        parser = LambdaFunction("Parser")
        parser << SimpleQueueServiceSqsMessage("reads message") << parser_queue
        parser << Edge(label="reads raw data") << raw_data
        parser >> Edge(label="insert timeseries data") >> timeseries_table


    with Cluster("Injectors"):
        with Cluster("HTTP Upload Injector"):
            authorizer = LambdaFunction("Authorizer check")
            authorizer >> Edge(label="looks up tenant") >> tenant_table
            APIGateway("API Gateway /gen-upload-url") >> authorizer >> Edge(label="generates pre-signed upload url")
            APIGateway("API Gateway /upload") >> Edge(xlabel="tenant uploads file") >> raw_data

        with Cluster("Email Injector"):
            SimpleEmailServiceSesEmail("incoming+secret_value@sensor-injector.prod.example.com") >> Edge(**{"xlabel": "arrives at"}) >> SimpleEmailServiceSes("SES Incoming Email") >> Edge(**{"xlabel": "puts"}) >> SimpleStorageServiceS3Bucket("Mail Temp store") >> Edge(label="Emits event") >> LambdaFunction("Mail Parser Function") >> raw_data

        with Cluster("Periodic (pull) Injector"):
            state_machine = StepFunctions("Coordination State Machine")
            Eventbridge("Scheduler") >> Edge(label="runs every X minutes") >> state_machine << Edge(label="reads injector_type=periodic") << tenant_table
            state_machine >> Edge(label="pulls data") << TraditionalServer("External datasource, e.g. "
                                                                           "FTP\n\nAdditional logic per type, "
                                                                           "e.g. delete from ftp server once copied "
                                                                           "to S3")
            state_machine >> Edge(xlabel="puts files") >> raw_data


