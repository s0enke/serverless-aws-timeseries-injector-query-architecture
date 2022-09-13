import awswrangler as wr
from pandas import read_csv, to_datetime, to_timedelta
from numpy import nan
import dateutil
#print(to_datetime('01.01.21 00:15'))
#print(dateutil.parser.parser('01.01.21 00:15').info)

#data = read_csv('/Users/soenke.ruempler/Downloads/example-files/WKA Starkwind.csv', encoding='iso-8859-1', skiprows=16, sep=';', header=0, names=['date_unparsed', 'time_unparsed', 'value'], dayfirst=True, on_bad_lines="error")
data = read_csv('/Users/soenke.ruempler/Downloads/example-files/20211022-095306463002__Z_WEA_53197721_20211019.csv', parse_dates=[0], encoding='iso-8859-1', sep=';', infer_datetime_format=True, usecols=[0,6,9,10], decimal=',',names=['date', 'generator_blindleistung',"leistung", "leistung_max"], header=0)
data = data.assign(sensor_id="asdf")

data = data.replace(-0.0, 0.0)
data = data.replace(nan, 0)

print(data.to_string())
rejected_records = wr.timestream.write(df=data, database="sampleDB", table="energy_data", time_col="date", measure_col=['generator_blindleistung',"leistung", "leistung_max"], dimensions_cols=['sensor_id'])
print(rejected_records)