This is a data-generator, for creating name/value data to be http posted to a data-collector.  This allows for creating pseudo real data as if collected from web/mobile analytics.

It uses a json file specifying fields, cardinality, frequency, of data to send

Usage:
	
	# send 1000 datapoints, 10 per second using the json file mydef.json
	./datagen -ct 1000 -persec 10  -file mydef.json


Json File Format (see datagen.json):

	# create a string ("datatype":"s") of random values, cardinality = 1000
	{"name":"_uid","cardinality":1000,"datatype":"s"}
	
	# Create an integer, cardinality of 100 named "temp"
	{"name":"temp","cardinality":100,"datatype":"i"}
	
	# create email, include in 20% (1 out of 5) requests, 
	#  choose from these values
	{"name":"email","values":["email@email.com","email2@email.com"],"every":5}
	

