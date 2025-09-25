package com;

import org.apache.cassandra.config.DatabaseDescriptor;
import org.apache.cassandra.cql3.QueryProcessor;
import org.apache.cassandra.schema.Schema;
import org.apache.cassandra.utils.FBUtilities;

import java.net.InetAddress;

public class JsonCqlQuery {

    static {
        System.setProperty("cassandra.config", "file:///");
        DatabaseDescriptor.clientInitialization();
        try {
            FBUtilities.setBroadcastInetAddress(InetAddress.getByName("127.0.0.1"));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public static void main(String[] args) throws Exception {
        // Create keyspace and table
        QueryProcessor.executeInternal(
            "CREATE KEYSPACE IF NOT EXISTS test_ks " +
            "WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};"
        );
        
        QueryProcessor.executeInternal(
            "CREATE TABLE IF NOT EXISTS test_ks.users (" +
            "id text PRIMARY KEY, name text, city text);"
        );

        // Print internal schema representation
        System.out.println("Keyspace metadata:");
        System.out.println(Schema.instance.getKeyspaceMetadata("test_ks"));
    }
}