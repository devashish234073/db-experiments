package com;

import javax.swing.JFrame;
import org.apache.cassandra.dht.IPartitioner;
import org.apache.cassandra.dht.Token;
import org.jfree.chart.ChartFactory;
import org.jfree.chart.ChartPanel;
import org.jfree.chart.JFreeChart;
import org.jfree.data.xy.XYSeries;
import org.jfree.data.xy.XYSeriesCollection;

public class DistributedHashTable {
    public static void main(String[] args) {

        int N = 100;
        XYSeries murmur3Series = new XYSeries("Murmur3Partitioner");
        XYSeries byteOrderedSeries = new XYSeries("ByteOrderedPartitioner");
        long murmur3Sum = 0L;
        java.math.BigInteger byteOrderedSum = java.math.BigInteger.ZERO;

        for (int i = 0; i < N; i++) {
            String key = "key-" + i;
            Token murmur3Token = getTokenUsingMurmur3Partitioner(key);
            Token byteOrderedToken = getTokenUsingByteOrderedPartitioner(key);
            long murmur3Value = tokenToLong(murmur3Token);
            java.math.BigInteger byteOrderedValue = tokenToBigInt(byteOrderedToken);
            System.out.println("byteOrderedValue: " + byteOrderedValue + ",byteOrderedToken: " + byteOrderedToken);
            System.out.println("murmur3Value: " + murmur3Value + ",murmur3Token: " + murmur3Token);
            murmur3Series.add(i, murmur3Value);
            byteOrderedSeries.add(i, byteOrderedValue);
            murmur3Sum += murmur3Value;
            byteOrderedSum = byteOrderedSum.add(byteOrderedValue);
        }

        double murmur3Avg = murmur3Sum / (double) N;
        java.math.BigDecimal byteOrderedAvg = new java.math.BigDecimal(byteOrderedSum)
                .divide(java.math.BigDecimal.valueOf(N));

        XYSeriesCollection dataset = new XYSeriesCollection();
        dataset.addSeries(murmur3Series);
        dataset.addSeries(byteOrderedSeries);

        JFreeChart chart = ChartFactory.createScatterPlot(
                "Token Distribution Comparison",
                "Key Index",
                "Token Value",
                dataset);

        JFrame frame = new JFrame("Partitioner Token Spread");
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        frame.add(new ChartPanel(chart));
        frame.setSize(900, 600);
        frame.setLocationRelativeTo(null);
        frame.setVisible(true);

        System.out.println("Average Murmur3Partitioner token value: " + murmur3Avg);
        System.out.println("Average ByteOrderedPartitioner token value: " + byteOrderedAvg.toPlainString());
    }

    // Helper to convert Token to long for plotting
    private static long tokenToLong(Token token) {
        String s = token.toString();
        try {
            if (s.startsWith("0x")) {
                // ByteOrderedPartitioner returns hex string
                return new java.math.BigInteger(s.substring(2), 16).longValue();
            } else {
                return Long.parseLong(s);
            }
        } catch (Exception e) {
            return 0L;
        }
    }

    /*private static java.math.BigInteger tokenToBigInt(Token token) {
        String s = token.toString();
        try {
            // Always treat as hex for ByteOrderedPartitioner
            return new java.math.BigInteger(s, 16);
        } catch (Exception e) {
            return java.math.BigInteger.ZERO;
        }
    }*/

    private static java.math.BigInteger tokenToBigInt(Token token) {
        try {
            // ByteOrderedPartitioner tokens are essentially the raw bytes of the key
            String hexString = token.toString(); // e.g. "6b65792d3936"
            return new java.math.BigInteger(hexString, 16); // correct interpretation
        } catch (Exception e) {
            return java.math.BigInteger.ZERO;
        }
    }

    private static Token getTokenUsingByteOrderedPartitioner(String key) {
        try {
            org.apache.cassandra.dht.ByteOrderedPartitioner partitioner = new org.apache.cassandra.dht.ByteOrderedPartitioner();
            Token token = getTokenUsingPartitioner(key, partitioner);
            return token;
        } catch (Exception e) {
            System.err.println("Error using ByteOrderedPartitioner: " + e.getMessage());
        }
        return null;
    }

    private static Token getTokenUsingMurmur3Partitioner(String key) {
        try {
            org.apache.cassandra.dht.Murmur3Partitioner partitioner = new org.apache.cassandra.dht.Murmur3Partitioner();
            Token token = getTokenUsingPartitioner(key, partitioner);
            return token;
        } catch (Exception e) {
            System.err.println("Error using Cassandra DHT class: " + e.getMessage());
        }
        return null;
    }

    private static Token getTokenUsingPartitioner(String key, IPartitioner partioner) {
        java.nio.ByteBuffer keyBuffer = java.nio.ByteBuffer.wrap(key.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        Token token = partioner.getToken(keyBuffer);
        return token;
    }
}
