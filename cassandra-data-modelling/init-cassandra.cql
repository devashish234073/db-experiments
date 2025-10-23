CREATE KEYSPACE IF NOT EXISTS userlogks
WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};

USE userlogks;

CREATE TABLE IF NOT EXISTS user_login_data (
    userId text,
    dob date,
    loginDate timestamp,
    firstname text,
    lastname text,
    logintime time,
    PRIMARY KEY ((userId, dob), loginDate)
)
WITH CLUSTERING ORDER BY (loginDate DESC);