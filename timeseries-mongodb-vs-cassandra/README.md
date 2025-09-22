To setup just create a stack in aws using timeseries-mongodb-vs-cassandra.yml

After setup query the cassandradb from ec2 terminal by running:

```
cqlsh
USE handtracking;
DESCRIBE TABLE gestures;
SELECT id, timestamp, coordinates FROM gestures LIMIT 10;
```

Similarly mongodb can be queried using:

```
mongosh
use handtracking
show collections
db.gestures.find()
```