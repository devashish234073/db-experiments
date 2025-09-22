To setup just create a stack in aws using timeseries-mongodb-vs-cassandra.yml

This will create the two instances:
<img width="1139" height="113" alt="image" src="https://github.com/user-attachments/assets/3c5ad6fc-8845-4402-9fbd-05906e3739f6" />

Cassandra instance takes some more time to setup so wait for around 3-5 minute for the UI to be available , mongo will be setup withing 1 minute.

Once both are setup, go to https://[publicIP]:3000 for each to show the hand tracking page , that sends the hand tracking coordinates to the corresponding database

After setup and doing some hand movement in from of cam, query the cassandradb from ec2 terminal by running:

```
cqlsh
USE handtracking;
DESCRIBE TABLE gestures;
SELECT id, timestamp, coordinates FROM gestures LIMIT 10;
```
<img width="1309" height="507" alt="image" src="https://github.com/user-attachments/assets/959c2b21-a269-4d50-bc8f-e82b20c1e41e" />

Similarly mongodb can be queried using:

```
mongosh
use handtracking
show collections
db.gestures.find()
```

<img width="1595" height="537" alt="image" src="https://github.com/user-attachments/assets/57fd0ca8-3a3f-4ce9-ae68-73912b2f0ca0" />


