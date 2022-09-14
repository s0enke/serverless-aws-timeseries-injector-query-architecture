import awswrangler as wr
from pandas import read_csv
import os

def handler(event, context):
    s3_url = 's3://{}/{}'.format(event['Records'][0]['s3']['bucket']['name'], event['Records'][0]['s3']['object']['key'])
    sensor_id = event['Records'][0]['s3']['object']['key'].split("/")[0]
    data = read_csv(s3_url, parse_dates=[0], encoding='iso-8859-1', sep=';', infer_datetime_format=True, usecols=[0,2], decimal=',', names=['date', 'measure'], header=0)
    data = data.assign(sensor_id=sensor_id)

    print(data.to_string())
    rejected_records = wr.timestream.write(df=data, database=os.environ.get('TIMESTREAM_DATABASE_NAME'), table=os.environ.get('TIMESTREAM_TABLE_NAME'), time_col="date", measure_col=['measure'], dimensions_cols=['sensor_id'])
    print(rejected_records)
